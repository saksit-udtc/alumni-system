#!/usr/bin/env bash
# shellcheck shell=bash
# =============================================================================
# common.sh — ฟังก์ชันที่ backup.sh และ restore.sh ใช้ร่วมกัน
# (ใช้ด้วยการ `source` เท่านั้น ไม่ต้องสั่งรันไฟล์นี้โดยตรง)
# =============================================================================

export LC_ALL="${LC_ALL:-C.UTF-8}"

BACKUP_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------- log ----------
log()  { printf '[%s] %s\n' "$(date '+%F %T')" "$*"; }
warn() { log "คำเตือน: $*" >&2; }
die()  { log "ผิดพลาด: $*" >&2; exit 1; }

need_cmd() {
  local c
  for c in "$@"; do
    command -v "$c" >/dev/null 2>&1 || die "ไม่พบคำสั่ง '$c' — ต้องติดตั้งก่อน (ดู backup/README.md)"
  done
}

# ---------- อ่านค่าจากไฟล์ .env ของ docker compose แบบปลอดภัย (ไม่ source) ----------
# ใช้: env_get KEY FILE   -> พิมพ์ค่า (ตัดเครื่องหมายคำพูด/คอมเมนต์ท้ายบรรทัดให้)
env_get() {
  local key=$1 file=$2 line val
  [[ -f $file ]] || return 0
  line=$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$file" | tail -n1 || true)
  [[ -n $line ]] || return 0
  val=${line#*=}
  val=${val%$'\r'}
  if [[ $val =~ ^\"(.*)\"[[:space:]]*(#.*)?$ ]]; then
    val=${BASH_REMATCH[1]}
  elif [[ $val =~ ^\'(.*)\'[[:space:]]*(#.*)?$ ]]; then
    val=${BASH_REMATCH[1]}
  else
    val=${val%% #*}
    val=${val%"${val##*[![:space:]]}"}   # trim ช่องว่างท้าย
  fi
  printf '%s' "$val"
}

# ---------- โหลดค่าตั้งต้น ----------
load_config() {
  local cfg="${BACKUP_CONFIG:-$BACKUP_SCRIPT_DIR/backup.env}"
  if [[ -f $cfg ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$cfg"
    set +a
  else
    warn "ไม่พบไฟล์ตั้งค่า $cfg — ใช้ค่าเริ่มต้นทั้งหมด (คัดลอกจาก backup.env.example ได้)"
  fi

  : "${COMPOSE_DIR:=$(cd "$BACKUP_SCRIPT_DIR/.." && pwd)}"
  : "${ENV_FILE:=$COMPOSE_DIR/.env}"
  : "${BACKUP_DIR:=/opt/backups/alumni}"
  : "${RCLONE_REMOTE:=gdrive-crypt}"
  : "${REMOTE_PATH:=alumni}"
  : "${KEEP_LOCAL_DAYS:=7}"
  : "${KEEP_REMOTE_DAYS:=30}"
  : "${KEEP_REMOTE_MIN:=7}"
  : "${KEEP_MONTHLY:=6}"
  : "${MIN_FREE_MB:=500}"
  : "${MINIO_ENDPOINT:=http://127.0.0.1:9002}"
  : "${MINIO_BUCKETS:=}"
  : "${ALLOW_PLAINTEXT_REMOTE:=false}"
  : "${HC_PING_URL:=}"
  : "${RCLONE_FLAGS:=--transfers=4 --checkers=8 --retries=5 --low-level-retries=10 --stats=0}"

  [[ -f $COMPOSE_DIR/docker-compose.yml ]] \
    || die "ไม่พบ $COMPOSE_DIR/docker-compose.yml (ตั้งค่า COMPOSE_DIR ใน backup.env ให้ถูกต้อง)"
  [[ -f $ENV_FILE ]] || warn "ไม่พบ $ENV_FILE — ใช้ค่าเริ่มต้นของ docker-compose แทน"

  PG_USER="$(env_get POSTGRES_USER "$ENV_FILE")";      : "${PG_USER:=alumni}"
  PG_DB="$(env_get POSTGRES_DB "$ENV_FILE")";          : "${PG_DB:=alumni_homecoming}"
  MINIO_USER="$(env_get MINIO_ROOT_USER "$ENV_FILE")"; : "${MINIO_USER:=minioadmin}"
  MINIO_PASS="$(env_get MINIO_ROOT_PASSWORD "$ENV_FILE")"; : "${MINIO_PASS:=minioadmin_change_me}"

  RBASE="${RCLONE_REMOTE}:${REMOTE_PATH}"
  RC_FLAGS=()
  read -r -a RC_FLAGS <<<"$RCLONE_FLAGS"
}

# ---------- docker / rclone wrappers ----------
dc() { ( cd "$COMPOSE_DIR" && docker compose "$@" ); }
pg() { dc exec -T postgres "$@"; }                       # รันคำสั่งภายใน container postgres
rc() { rclone ${RC_FLAGS[@]+"${RC_FLAGS[@]}"} "$@"; }    # rclone พร้อมแฟลกจาก RCLONE_FLAGS

service_running() {
  local id
  id=$(dc ps -q "$1" 2>/dev/null | head -n1)
  [[ -n $id ]] && [[ "$(docker inspect -f '{{.State.Running}}' "$id" 2>/dev/null)" == true ]]
}

# ---------- ตรวจ remote ปลายทาง (ต้องเป็น crypt เว้นแต่อนุญาตเอง) ----------
check_remote() {
  local t
  t=$(rclone listremotes --long 2>/dev/null | awk -v n="${RCLONE_REMOTE}:" '$1==n {print $2}')
  # shellcheck disable=SC2034  # ใช้ใน backup.sh
  REMOTE_TYPE=$t
  [[ -n $t ]] || die "ไม่พบ remote '${RCLONE_REMOTE}' ใน rclone config (ตั้งค่าตาม backup/NAS.md หรือ backup/README.md ข้อ 3)"
  if [[ $t != crypt ]]; then
    if [[ $ALLOW_PLAINTEXT_REMOTE == true ]]; then
      warn "remote '${RCLONE_REMOTE}' ไม่ได้เข้ารหัส (ชนิด $t) — ข้อมูลศิษย์เก่าและสลิปจะอยู่บนปลายทางแบบอ่านได้"
    else
      die "remote '${RCLONE_REMOTE}' เป็นชนิด '$t' ไม่ใช่ crypt — ข้อมูลมีข้อมูลส่วนบุคคล จึงบังคับให้เข้ารหัสก่อนส่งออก (ถ้าจำเป็นจริงให้ตั้ง ALLOW_PLAINTEXT_REMOTE=true)"
    fi
  fi
  rc mkdir "$RBASE" >/dev/null 2>&1 || die "เข้าถึง $RBASE ไม่ได้ (ตรวจ token/เครือข่าย: rclone lsd ${RCLONE_REMOTE}:)"
}

# ---------- MinIO เป็นแหล่งข้อมูลของ rclone (ตั้งค่าผ่าน env ไม่ต้องแก้ rclone.conf) ----------
minio_setup_source() {
  export RCLONE_CONFIG_MINIOSRC_TYPE=s3
  export RCLONE_CONFIG_MINIOSRC_PROVIDER=Minio
  export RCLONE_CONFIG_MINIOSRC_ENDPOINT="$MINIO_ENDPOINT"
  export RCLONE_CONFIG_MINIOSRC_ACCESS_KEY_ID="$MINIO_USER"
  export RCLONE_CONFIG_MINIOSRC_SECRET_ACCESS_KEY="$MINIO_PASS"
  export RCLONE_CONFIG_MINIOSRC_ENV_AUTH=false
}

# พิมพ์รายชื่อ bucket ทั้งหมดใน MinIO (หรือตาม MINIO_BUCKETS ถ้ากำหนด)
minio_list_buckets() {
  if [[ -n $MINIO_BUCKETS ]]; then
    tr ' ,' '\n\n' <<<"$MINIO_BUCKETS" | sed '/^$/d'
    return 0
  fi
  local out
  out=$(rclone lsf miniosrc: --dirs-only) || return 1
  sed 's:/$::' <<<"$out" | sed '/^$/d'
}

# พิมพ์ "จำนวนไฟล์ ขนาดbytes" ของ path
path_stats() {
  local j
  j=$(rclone size --json "$1" 2>/dev/null) || { echo "0 0"; return 0; }
  printf '%s %s\n' \
    "$(sed -n 's/.*"count":\([0-9]*\).*/\1/p' <<<"$j")" \
    "$(sed -n 's/.*"bytes":\([0-9]*\).*/\1/p' <<<"$j")"
}

human() {
  if command -v numfmt >/dev/null 2>&1; then numfmt --to=iec --suffix=B "${1:-0}"; else echo "${1:-0}B"; fi
}

# ---------- เลือกชื่อไฟล์ที่หมดอายุ ----------
# stdin: รายชื่อไฟล์/โฟลเดอร์ (ชื่อต้องมี YYYYMMDD_HHMMSS)   $1=เก็บกี่วัน  $2=อย่างน้อยกี่ไฟล์ล่าสุดที่ห้ามลบ
# stdout: ชื่อที่ควรลบ (ชื่อที่ไม่มีวันที่จะไม่ถูกแตะเลย)
select_expired() {
  local days=$1 keep_min=$2 cutoff total i n d
  local -a names=()
  cutoff=$(date -d "-${days} days" +%Y%m%d)
  mapfile -t names < <(sed '/^$/d' | sort)
  total=${#names[@]}
  for ((i = 0; i < total - keep_min; i++)); do
    n=${names[i]}
    if [[ $n =~ (^|_)([0-9]{8})_[0-9]{6} ]]; then
      d=${BASH_REMATCH[2]}
      if [[ $d < $cutoff ]]; then printf '%s\n' "$n"; fi
    fi
  done
  return 0
}

# ---------- นับจำนวนแถวทุกตารางใน public ของฐานข้อมูลที่ระบุ ----------
COUNT_SQL="SELECT table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint AS row_count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1;"

print_counts() {
  pg psql -U "$PG_USER" -d "$1" -At -F '  ' -c "$COUNT_SQL"
}
