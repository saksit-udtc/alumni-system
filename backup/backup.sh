#!/usr/bin/env bash
# =============================================================================
# backup.sh — สำรองข้อมูลระบบคืนสู่เหย้าไปยังที่เก็บภายนอก (Synology NAS ผ่าน SFTP หรือ Google Drive) เข้ารหัสด้วย rclone crypt
#
# สำรองอะไรบ้าง
#   1) ฐานข้อมูล PostgreSQL  (pg_dump รูปแบบ custom)        -> <remote>/db/  และ <remote>/monthly/
#   2) ไฟล์ใน MinIO ทุก bucket (สลิป, รูปสินค้า, แบนเนอร์ ...)  -> <remote>/minio/<bucket>/
#      ไฟล์ที่ถูกลบ/ทับที่ต้นทาง จะถูกย้ายไป <remote>/minio-deleted/<เวลา>/ ไม่หายทันที
#   3) ไฟล์ .env (รหัสผ่าน/คีย์ต่าง ๆ) เฉพาะเมื่อมีการเปลี่ยนแปลง  -> <remote>/config/
#
# วิธีใช้
#   bash backup/backup.sh                 สำรองทั้งหมด
#   bash backup/backup.sh --db-only       เฉพาะฐานข้อมูล (เหมาะกับช่วงงานที่ต้องสำรองถี่ ๆ)
#   bash backup/backup.sh --minio-only    เฉพาะไฟล์ใน MinIO
#   bash backup/backup.sh --label pre-deploy   ติดป้ายชื่อไฟล์ (เช่น สำรองก่อน deploy)
#   bash backup/backup.sh --check         ตรวจความพร้อมอย่างเดียว ไม่สำรองจริง
#
# ตั้งค่าที่ backup/backup.env (คัดลอกจาก backup.env.example)
# =============================================================================
set -Eeuo pipefail

# shellcheck source=common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

MODE=all
LABEL=""
CHECK_ONLY=false

usage() { sed -n '3,18p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

while (($#)); do
  case $1 in
    --db-only)    MODE=db ;;
    --minio-only) MODE=minio ;;
    --check)      CHECK_ONLY=true ;;
    --label)      LABEL=${2:-}; shift ;;
    -h|--help)    usage; exit 0 ;;
    *)            die "ไม่รู้จักตัวเลือก '$1' (ดู --help)" ;;
  esac
  shift
done
if [[ -n $LABEL && ! $LABEL =~ ^[A-Za-z0-9-]+$ ]]; then
  die "--label ใช้ได้เฉพาะ A-Z a-z 0-9 และ - เท่านั้น"
fi

load_config
need_cmd docker rclone flock

mkdir -p "$BACKUP_DIR/db"
chmod 700 "$BACKUP_DIR" 2>/dev/null || true
LOG_FILE="$BACKUP_DIR/backup.log"
if [[ -f $LOG_FILE && $(stat -c %s "$LOG_FILE") -gt 5242880 ]]; then
  mv -f "$LOG_FILE" "$LOG_FILE.1"          # หมุน log เมื่อเกิน 5 MB
fi
exec > >(tee -a "$LOG_FILE") 2>&1

# กันรันซ้อนกัน (เช่น สำรองรอบก่อนยังไม่จบ)
exec 9>"$BACKUP_DIR/.backup.lock"
flock -n 9 || die "มีการสำรองอีกรอบกำลังทำงานอยู่ — ออก"

# ---------- แจ้งสถานะไปยัง healthchecks.io (ถ้าตั้ง HC_PING_URL) ----------
hc_ping() {
  [[ -n $HC_PING_URL ]] && command -v curl >/dev/null 2>&1 || return 0
  local suffix=${1:-}
  if [[ $suffix == /fail ]]; then
    curl -fsS -m 15 --retry 2 -o /dev/null --data-raw "$(tail -n 30 "$LOG_FILE")" "${HC_PING_URL%/}$suffix" || true
  else
    curl -fsS -m 15 --retry 2 -o /dev/null "${HC_PING_URL%/}$suffix" || true
  fi
}
on_exit() {
  local rc=$?
  $CHECK_ONLY && return 0          # โหมด --check ไม่ส่งสัญญาณไป healthchecks
  if ((rc == 0)); then
    hc_ping ""
  else
    log "การสำรองล้มเหลว (exit $rc) — ดูรายละเอียดใน $LOG_FILE"
    hc_ping /fail
  fi
}
trap on_exit EXIT
$CHECK_ONLY || hc_ping /start

TS=$(date +%Y%m%d_%H%M%S)
T0=$(date +%s)

# =============================================================================
# 0) ตรวจความพร้อม
# =============================================================================
preflight() {
  log "ตรวจความพร้อม ..."
  local free_mb
  free_mb=$(df -Pm "$BACKUP_DIR" | awk 'NR==2 {print $4}')
  ((free_mb >= MIN_FREE_MB)) || die "พื้นที่ว่างที่ $BACKUP_DIR เหลือ ${free_mb}MB (< ${MIN_FREE_MB}MB)"
  log "  พื้นที่ว่างในเครื่อง: ${free_mb} MB"

  if [[ $MODE != minio ]]; then
    service_running postgres || die "container postgres ไม่ได้ทำงาน (docker compose ps)"
    pg pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null || die "postgres ยังไม่พร้อมรับการเชื่อมต่อ"
    log "  postgres: พร้อม"
  fi
  if [[ $MODE != db ]]; then
    minio_setup_source
    rclone lsf miniosrc: --dirs-only >/dev/null 2>&1 \
      || die "เชื่อมต่อ MinIO ที่ $MINIO_ENDPOINT ไม่ได้ (ตรวจพอร์ต/รหัสผ่านใน .env และค่า MINIO_ENDPOINT)"
    log "  MinIO: พร้อม ($MINIO_ENDPOINT)"
  fi
  check_remote
  if [[ $REMOTE_TYPE == crypt ]]; then
    log "  ปลายทาง: $RBASE (เข้ารหัส)"
  else
    log "  ปลายทาง: $RBASE (ไม่เข้ารหัส!)"
  fi
}

# =============================================================================
# 1) ฐานข้อมูล
# =============================================================================
backup_db() {
  local name="alumni_db_${TS}${LABEL:+_$LABEL}.dump"
  local final="$BACKUP_DIR/db/$name" part="$BACKUP_DIR/db/.$name.partial"
  local size rsize ym

  log "สำรองฐานข้อมูล '$PG_DB' ..."
  if ! pg pg_dump -U "$PG_USER" -d "$PG_DB" -Fc --no-owner --no-acl >"$part"; then
    rm -f "$part"; die "pg_dump ล้มเหลว"
  fi
  [[ -s $part ]] || { rm -f "$part"; die "ไฟล์ dump ว่างเปล่า"; }
  # ตรวจว่าไฟล์อ่านกลับได้จริง (สารบัญของ dump ครบ)
  if ! pg pg_restore -l <"$part" >/dev/null; then
    rm -f "$part"; die "ไฟล์ dump อ่านกลับไม่ได้ — ไม่อัปโหลด"
  fi
  mv "$part" "$final"
  size=$(stat -c %s "$final")
  log "  ได้ไฟล์ $name ($(human "$size"))"

  rc copyto "$final" "$RBASE/db/$name" || die "อัปโหลด dump ขึ้นปลายทางล้มเหลว"
  rsize=$(rclone lsf "$RBASE/db/$name" --format s 2>/dev/null | head -n1 || true)
  [[ $rsize == "$size" ]] || die "ตรวจขนาดไฟล์บนปลายทางไม่ตรง (ในเครื่อง=$size, บนปลายทาง=${rsize:-ไม่พบ})"
  log "  อัปโหลดและตรวจขนาดแล้ว -> $RBASE/db/$name"

  # สำเนารายเดือน: เก็บ 1 ไฟล์/เดือน ไว้นานกว่ารายวัน (กันกรณีข้อมูลเสียแล้วเพิ่งรู้ทีหลัง)
  if [[ -z $LABEL ]]; then
    ym=${TS:0:6}
    if [[ -z $(rclone lsf "$RBASE/monthly" --files-only --include "alumni_db_${ym}*" 2>/dev/null || true) ]]; then
      rc copyto "$RBASE/db/$name" "$RBASE/monthly/$name" || warn "สร้างสำเนารายเดือนไม่สำเร็จ"
      log "  สร้างสำเนารายเดือน -> monthly/$name"
    fi
  fi
}

# =============================================================================
# 2) MinIO
# =============================================================================
backup_minio() {
  local buckets b cnt bytes total_cnt=0 total_bytes=0
  buckets=$(minio_list_buckets) || die "อ่านรายชื่อ bucket จาก MinIO ไม่ได้"
  [[ -n $buckets ]] || die "ไม่พบ bucket ใน MinIO เลย — ผิดปกติ จึงไม่ sync (กันการล้างข้อมูลบนปลายทาง)"

  while IFS= read -r b; do
    read -r cnt bytes < <(path_stats "miniosrc:$b")
    log "MinIO bucket '$b': $cnt ไฟล์, $(human "$bytes")"
    total_cnt=$((total_cnt + cnt)); total_bytes=$((total_bytes + bytes))

    # sync แบบ mirror แต่ไฟล์ที่ถูกลบ/ทับ จะย้ายไป minio-deleted/<เวลา>/ แทนการลบทิ้ง
    rc sync "miniosrc:$b" "$RBASE/minio/$b" --backup-dir "$RBASE/minio-deleted/$TS/$b" \
      || die "sync bucket '$b' ล้มเหลว"

    # ตรวจว่าทุกไฟล์ต้นทางมีบนปลายทางขนาดตรงกัน (ถ้ามีไฟล์เข้าใหม่ระหว่างทำ ให้ sync ซ้ำอีกครั้ง)
    if ((cnt > 0)) && ! rc check "miniosrc:$b" "$RBASE/minio/$b" --size-only --one-way >/dev/null 2>&1; then
      warn "bucket '$b': ตรวจไม่ผ่านรอบแรก — sync ซ้ำอีกครั้ง"
      rc sync "miniosrc:$b" "$RBASE/minio/$b" --backup-dir "$RBASE/minio-deleted/$TS/$b" || die "sync ซ้ำ bucket '$b' ล้มเหลว"
      rc check "miniosrc:$b" "$RBASE/minio/$b" --size-only --one-way >/dev/null 2>&1 \
        || die "bucket '$b': ไฟล์บนปลายทางไม่ตรงกับต้นทางหลัง sync ซ้ำ"
    fi
  done <<<"$buckets"
  log "  MinIO รวม $total_cnt ไฟล์, $(human "$total_bytes") — sync และตรวจแล้ว"
}

# =============================================================================
# 3) ไฟล์ตั้งค่า .env (อัปโหลดเฉพาะเมื่อเปลี่ยน)
# =============================================================================
backup_env() {
  [[ -f $ENV_FILE ]] || { warn "ไม่มี $ENV_FILE — ข้ามการสำรอง .env"; return 0; }
  local sum_file="$BACKUP_DIR/.env.sha256" cur old=""
  cur=$(sha256sum "$ENV_FILE" | awk '{print $1}')
  [[ -f $sum_file ]] && old=$(cat "$sum_file")
  if [[ $cur != "$old" ]] || [[ -z $(rclone lsf "$RBASE/config" --files-only 2>/dev/null || true) ]]; then
    rc copyto "$ENV_FILE" "$RBASE/config/env_${TS}" || die "อัปโหลด .env ล้มเหลว"
    printf '%s' "$cur" >"$sum_file"
    log "อัปโหลด .env (มีการเปลี่ยนแปลง) -> config/env_${TS}"
  else
    log ".env ไม่มีการเปลี่ยนแปลง — ข้าม"
  fi
}

# =============================================================================
# 4) ลบของเก่า (ทำหลังอัปโหลดสำเร็จเท่านั้น และเก็บไฟล์ล่าสุดไว้เสมอ)
# =============================================================================
prune_all() {
  local n

  # ในเครื่อง
  while IFS= read -r n; do
    [[ -n $n ]] || continue
    rm -f "$BACKUP_DIR/db/$n" && log "ลบสำเนาเก่าในเครื่อง: $n"
  done < <(find "$BACKUP_DIR/db" -maxdepth 1 -type f -name 'alumni_db_*.dump' -printf '%f\n' \
             | select_expired "$KEEP_LOCAL_DAYS" 3)

  # บนปลายทาง: รายวัน
  while IFS= read -r n; do
    [[ -n $n ]] || continue
    rc deletefile "$RBASE/db/$n" && log "ลบสำเนาเก่าบนปลายทาง: db/$n"
  done < <(rclone lsf "$RBASE/db" --files-only 2>/dev/null | select_expired "$KEEP_REMOTE_DAYS" "$KEEP_REMOTE_MIN")

  # บนปลายทาง: รายเดือน (เก็บ KEEP_MONTHLY ไฟล์ล่าสุด)
  while IFS= read -r n; do
    [[ -n $n ]] || continue
    rc deletefile "$RBASE/monthly/$n" && log "ลบสำเนารายเดือนเก่า: monthly/$n"
  done < <(rclone lsf "$RBASE/monthly" --files-only 2>/dev/null | sort | head -n "-${KEEP_MONTHLY}" || true)

  # บนปลายทาง: .env รุ่นเก่า
  while IFS= read -r n; do
    [[ -n $n ]] || continue
    rc deletefile "$RBASE/config/$n" && log "ลบ .env รุ่นเก่า: config/$n"
  done < <(rclone lsf "$RBASE/config" --files-only 2>/dev/null | select_expired "$KEEP_REMOTE_DAYS" 3)

  # บนปลายทาง: ไฟล์ MinIO ที่ถูกลบ/ทับ (เก็บตามจำนวนวัน)
  while IFS= read -r n; do
    [[ -n $n ]] || continue
    n=${n%/}
    rc purge "$RBASE/minio-deleted/$n" && log "ลบที่พักไฟล์ที่ถูกลบเก่า: minio-deleted/$n"
  done < <(rclone lsf "$RBASE/minio-deleted" --dirs-only 2>/dev/null | select_expired "$KEEP_REMOTE_DAYS" 0)
}

# =============================================================================
# main
# =============================================================================
preflight
if $CHECK_ONLY; then
  log "ตรวจความพร้อมผ่านทั้งหมด — พร้อมสำรอง"
  exit 0
fi

log "===== เริ่มสำรอง (โหมด: $MODE${LABEL:+, ป้าย: $LABEL}) ====="
[[ $MODE == minio ]] || backup_db
[[ $MODE == db ]]    || backup_minio
[[ $MODE == minio ]] || backup_env
prune_all

printf '%s\n' "$TS" >"$BACKUP_DIR/last_success"
log "===== สำรองสำเร็จ ใช้เวลา $(($(date +%s) - T0)) วินาที ====="
