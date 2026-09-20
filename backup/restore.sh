#!/usr/bin/env bash
# =============================================================================
# restore.sh — กู้คืนข้อมูลระบบคืนสู่เหย้าจากที่สำรองไว้บนปลายทาง (Synology NAS หรือ Google Drive)
#
# วิธีใช้
#   bash backup/restore.sh list                         ดูว่ามีอะไรสำรองไว้บ้าง
#   bash backup/restore.sh test [latest|ชื่อไฟล์]        ทดลอง restore ลงฐานข้อมูลชั่วคราว (ปลอดภัย ไม่แตะข้อมูลจริง)
#   bash backup/restore.sh db   [latest|ชื่อไฟล์|/path/ไฟล์.dump]   กู้ฐานข้อมูลจริง (ทับของเดิม!)
#   bash backup/restore.sh minio [all|bucket ...] [--mirror]      กู้ไฟล์ใน MinIO กลับเข้า bucket
#   bash backup/restore.sh env  [latest|ชื่อไฟล์] [--out ไฟล์]      ดาวน์โหลด .env เก่าออกมาดู (ไม่ทับ .env จริง)
#
# ตัวเลือกทั่วไป
#   --yes       ข้ามการถามยืนยัน (ระวัง! ใช้เมื่อรู้ว่าทำอะไรอยู่เท่านั้น)
#   --dry-run   (เฉพาะ minio) แสดงว่าจะคัดลอกอะไร โดยไม่ทำจริง
#
# รายละเอียดทีละขั้นตอนอยู่ใน backup/RESTORE.md
# =============================================================================
set -Eeuo pipefail

# shellcheck source=common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

ASSUME_YES=false
DRY_RUN=false
MIRROR=false
OUT_FILE=""
ARGS=()

usage() { sed -n '3,16p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

while (($#)); do
  case $1 in
    --yes)     ASSUME_YES=true ;;
    --dry-run) DRY_RUN=true ;;
    --mirror)  MIRROR=true ;;
    --out)     OUT_FILE=${2:-}; shift ;;
    -h|--help) usage; exit 0 ;;
    *)         ARGS+=("$1") ;;
  esac
  shift
done
CMD=${ARGS[0]:-}
[[ -n $CMD ]] || { usage; exit 1; }
ARGS=("${ARGS[@]:1}")

load_config
need_cmd docker rclone

WORK_DIR=""
cleanup() { [[ -n $WORK_DIR && -d $WORK_DIR ]] && rm -rf "$WORK_DIR"; return 0; }
trap cleanup EXIT
make_work_dir() {
  mkdir -p "$BACKUP_DIR/tmp"
  WORK_DIR=$(mktemp -d "$BACKUP_DIR/tmp/restore.XXXXXX")
}

confirm_typed() {          # $1 = คำที่ต้องพิมพ์ให้ตรงเพื่อยืนยัน
  [[ $ASSUME_YES == true ]] && return 0
  [[ -t 0 ]] || die "ต้องรันจากเทอร์มินัลแบบโต้ตอบ (หรือใส่ --yes)"
  local ans
  read -r -p "พิมพ์ '$1' เพื่อยืนยัน (กด Enter เฉยๆ = ยกเลิก): " ans
  [[ $ans == "$1" ]]
}

# ---------- หาไฟล์ dump: latest | ชื่อไฟล์บนปลายทาง | path ในเครื่อง -> ดาวน์โหลดมาไว้ที่ WORK_DIR ----------
fetch_dump() {
  local want=${1:-latest} name src=""
  if [[ -f $want ]]; then
    DUMP_FILE=$want
    DUMP_LABEL="ไฟล์ในเครื่อง $want"
    return 0
  fi
  if [[ $want == latest ]]; then
    name=$(rclone lsf "$RBASE/db" --files-only 2>/dev/null | grep -E '^alumni_db_.*\.dump$' | sort | tail -n1 || true)
    if [[ -n $name ]]; then src="$RBASE/db/$name"; else
      name=$(rclone lsf "$RBASE/monthly" --files-only 2>/dev/null | grep -E '^alumni_db_.*\.dump$' | sort | tail -n1 || true)
      [[ -n $name ]] && src="$RBASE/monthly/$name"
    fi
  else
    name=$(basename "$want")
    if rclone lsf "$RBASE/db/$name" >/dev/null 2>&1; then src="$RBASE/db/$name"
    elif rclone lsf "$RBASE/monthly/$name" >/dev/null 2>&1; then src="$RBASE/monthly/$name"
    fi
  fi
  [[ -n $src ]] || die "ไม่พบไฟล์สำรองฐานข้อมูล '$want' บนปลายทาง (ลอง: restore.sh list)"

  [[ -n $WORK_DIR ]] || make_work_dir
  log "ดาวน์โหลด $src ..."
  rc copyto "$src" "$WORK_DIR/$name" || die "ดาวน์โหลดไม่สำเร็จ"
  DUMP_FILE="$WORK_DIR/$name"
  DUMP_LABEL="$name"
}

verify_dump() {
  [[ -s $1 ]] || die "ไฟล์ dump ว่างเปล่า"
  pg pg_restore -l <"$1" >/dev/null || die "ไฟล์ dump เสียหาย/อ่านไม่ได้ — อย่าใช้ไฟล์นี้"
  log "ไฟล์ dump ตรวจแล้ว อ่านได้ปกติ ($(human "$(stat -c %s "$1")"))"
}

# =============================================================================
# list
# =============================================================================
cmd_list() {
  check_remote
  echo "=== ฐานข้อมูลรายวัน   ($RBASE/db) ==="
  rclone lsf "$RBASE/db" --files-only --format ps 2>/dev/null | sort | sed 's/;/   ขนาด(bytes)=/' || true
  echo
  echo "=== ฐานข้อมูลรายเดือน ($RBASE/monthly) ==="
  rclone lsf "$RBASE/monthly" --files-only --format ps 2>/dev/null | sort | sed 's/;/   ขนาด(bytes)=/' || true
  echo
  echo "=== ไฟล์ตั้งค่า .env  ($RBASE/config) ==="
  rclone lsf "$RBASE/config" --files-only 2>/dev/null | sort || true
  echo
  echo "=== MinIO ($RBASE/minio) ==="
  local b cnt bytes
  while IFS= read -r b; do
    [[ -n $b ]] || continue
    read -r cnt bytes < <(path_stats "$RBASE/minio/${b%/}")
    printf '  %-20s %8s ไฟล์  %s\n' "${b%/}" "$cnt" "$(human "$bytes")"
  done < <(rclone lsf "$RBASE/minio" --dirs-only 2>/dev/null || true)
  echo
  echo "=== ที่พักไฟล์ MinIO ที่ถูกลบ/ทับ ($RBASE/minio-deleted) ==="
  rclone lsf "$RBASE/minio-deleted" --dirs-only 2>/dev/null | sort || true
  echo
  echo "=== สำเนาในเครื่องนี้ ($BACKUP_DIR/db) ==="
  find "$BACKUP_DIR/db" -maxdepth 1 -type f -name '*.dump' -printf '%f\n' 2>/dev/null | sort || true
  [[ -f $BACKUP_DIR/last_success ]] && echo && echo "สำรองสำเร็จครั้งล่าสุด: $(cat "$BACKUP_DIR/last_success")  (รูปแบบ ปีเดือนวัน_เวลา)"
  return 0
}

# =============================================================================
# test — restore ลงฐานข้อมูลชั่วคราว แล้วนับแถว (ไม่กระทบข้อมูลจริง)
# =============================================================================
cmd_test() {
  check_remote
  service_running postgres || die "container postgres ไม่ได้ทำงาน"
  make_work_dir
  fetch_dump "${ARGS[0]:-latest}"
  verify_dump "$DUMP_FILE"

  local tmpdb
  tmpdb="restore_test_$(date +%Y%m%d_%H%M%S)"
  # shellcheck disable=SC2064
  trap "pg psql -U '$PG_USER' -d postgres -q -c 'DROP DATABASE IF EXISTS \"$tmpdb\" WITH (FORCE)' >/dev/null 2>&1 || true; cleanup" EXIT

  log "สร้างฐานข้อมูลชั่วคราว $tmpdb แล้ว restore จาก $DUMP_LABEL ..."
  pg psql -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE \"$tmpdb\"" \
    || die "สร้างฐานข้อมูลชั่วคราวไม่ได้"
  pg pg_restore -U "$PG_USER" -d "$tmpdb" --no-owner --no-acl <"$DUMP_FILE" \
    || die "restore ลงฐานข้อมูลชั่วคราวมีข้อผิดพลาด — ไฟล์สำรองนี้อาจใช้ไม่ได้"

  echo
  echo "จำนวนแถวในแต่ละตาราง (จากไฟล์สำรอง: $DUMP_LABEL)"
  echo "-------------------------------------------------"
  print_counts "$tmpdb"
  echo "-------------------------------------------------"
  log "ทดสอบ restore สำเร็จ — ไฟล์สำรองนี้ใช้กู้คืนได้จริง (ฐานข้อมูลชั่วคราวจะถูกลบทิ้ง)"
  echo "เทียบตัวเลขข้างบนกับระบบจริงได้ที่ /admin หรือรัน: docker compose exec postgres psql -U $PG_USER -d $PG_DB"
}

# =============================================================================
# db — restore ฐานข้อมูลจริง (ทับของเดิม)
# =============================================================================
cmd_db() {
  check_remote
  service_running postgres || die "container postgres ไม่ได้ทำงาน (ถ้าเป็นเครื่องใหม่ให้ docker compose up -d ก่อน)"
  make_work_dir
  fetch_dump "${ARGS[0]:-latest}"
  verify_dump "$DUMP_FILE"

  echo
  echo "############################################################"
  echo "# กำลังจะ 'ลบฐานข้อมูล $PG_DB ปัจจุบันทิ้งทั้งหมด'"
  echo "# แล้วกู้คืนจาก: $DUMP_LABEL"
  echo "# ระหว่างนี้เว็บ (app) และงานตั้งเวลา (cron) จะถูกหยุดชั่วคราว"
  echo "# ข้อมูลที่เกิดขึ้นหลังเวลาของไฟล์สำรองนี้จะหายไป"
  echo "# (ระบบจะสำรองฐานข้อมูลปัจจุบันไว้ให้ก่อน เพื่อย้อนกลับได้)"
  echo "############################################################"
  confirm_typed "$PG_DB" || die "ยกเลิก — ไม่ได้แก้ไขอะไร"

  # 1) สำรองสภาพปัจจุบันไว้ก่อน (ย้อนกลับได้)
  local snap
  snap="$BACKUP_DIR/db/pre_restore_$(date +%Y%m%d_%H%M%S).dump.keep"
  mkdir -p "$BACKUP_DIR/db"
  if pg pg_dump -U "$PG_USER" -d "$PG_DB" -Fc --no-owner --no-acl >"$snap" 2>/dev/null && [[ -s $snap ]]; then
    log "สำรองฐานข้อมูลปัจจุบันไว้ที่ $snap (ไว้ย้อนกลับ)"
  else
    rm -f "$snap"
    warn "สำรองฐานข้อมูลปัจจุบันไม่ได้ (อาจว่าง/เสียหายอยู่แล้ว)"
    confirm_typed "ไม่มีสำรอง" || die "ยกเลิก"
  fi

  # 2) หยุด app + cron เพื่อไม่ให้มีการเชื่อมต่อค้าง/เขียนข้อมูลระหว่างกู้
  log "หยุด app และ cron ชั่วคราว ..."
  dc stop app cron >/dev/null 2>&1 || warn "หยุด app/cron ไม่สำเร็จ (อาจยังไม่ได้สร้าง) — ทำต่อ"

  # 3) สร้างฐานข้อมูลใหม่เปล่า แล้ว restore
  log "สร้างฐานข้อมูล $PG_DB ใหม่ ..."
  pg psql -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 -q \
      -c "DROP DATABASE IF EXISTS \"$PG_DB\" WITH (FORCE)" \
      -c "CREATE DATABASE \"$PG_DB\" OWNER \"$PG_USER\"" \
    || die "สร้างฐานข้อมูลใหม่ไม่ได้ — app/cron ยังหยุดอยู่ (dc up -d app cron เมื่อพร้อม)"

  log "restore ข้อมูล ..."
  if ! pg pg_restore -U "$PG_USER" -d "$PG_DB" --no-owner --no-acl <"$DUMP_FILE"; then
    warn "pg_restore แจ้งข้อผิดพลาด — ตรวจข้อความด้านบน"
    warn "ถ้าต้องการย้อนกลับ: bash backup/restore.sh db '$snap'   (app/cron ยังหยุดอยู่)"
    exit 1
  fi

  echo
  echo "จำนวนแถวหลังกู้คืน:"
  print_counts "$PG_DB"

  # 4) เปิดระบบกลับ (app จะรัน prisma migrate deploy เองตอนเริ่ม)
  log "เปิด app และ cron กลับ ..."
  dc up -d app cron
  log "กู้คืนฐานข้อมูลเสร็จ — ลองล็อกอิน /admin และตรวจข้อมูลล่าสุดได้เลย"
  [[ -f $snap ]] && log "สำเนาก่อนกู้ (เก็บไว้ ไม่ถูกลบอัตโนมัติ): $snap"
  return 0
}

# =============================================================================
# minio — กู้ไฟล์กลับเข้า MinIO
# =============================================================================
cmd_minio() {
  check_remote
  service_running minio || die "container minio ไม่ได้ทำงาน (docker compose up -d ก่อน)"
  minio_setup_source

  local -a wanted=("${ARGS[@]}")
  ((${#wanted[@]})) || wanted=(all)
  local -a buckets=()
  if [[ ${wanted[0]} == all ]]; then
    mapfile -t buckets < <(rclone lsf "$RBASE/minio" --dirs-only 2>/dev/null | sed 's:/$::' | sed '/^$/d')
  else
    buckets=("${wanted[@]}")
  fi
  ((${#buckets[@]})) || die "ไม่พบ bucket สำรองบนปลายทาง ($RBASE/minio)"

  # ให้ minio-init สร้าง bucket และตั้ง policy (public-read) ให้ตามเดิม — ทำซ้ำได้ปลอดภัย
  dc up minio-init >/dev/null 2>&1 || warn "รัน minio-init ไม่สำเร็จ (ถ้า bucket ยังไม่มี จะสร้างให้แบบไม่มี policy public)"

  local b cnt bytes flags=()
  $DRY_RUN && flags+=(--dry-run)
  if $MIRROR; then
    echo "โหมด --mirror: ไฟล์ใน MinIO ที่ 'ไม่มี' ในไฟล์สำรองจะถูกลบ (ให้ตรงกับสำรองเป๊ะ)"
    $DRY_RUN || confirm_typed "MIRROR" || die "ยกเลิก"
  fi

  for b in "${buckets[@]}"; do
    read -r cnt bytes < <(path_stats "$RBASE/minio/$b")
    log "กู้ bucket '$b' จากสำรอง ($cnt ไฟล์, $(human "$bytes")) ..."
    rclone mkdir "miniosrc:$b" 2>/dev/null || true
    if $MIRROR; then
      rc sync "$RBASE/minio/$b" "miniosrc:$b" ${flags[@]+"${flags[@]}"} || die "กู้ bucket '$b' ไม่สำเร็จ"
    else
      # ค่าเริ่มต้น: copy เท่านั้น ไม่ลบอะไรใน MinIO ปัจจุบัน
      rc copy "$RBASE/minio/$b" "miniosrc:$b" ${flags[@]+"${flags[@]}"} || die "กู้ bucket '$b' ไม่สำเร็จ"
    fi
  done
  if $DRY_RUN; then
    log "dry-run เสร็จ — ยังไม่ได้เปลี่ยนอะไรจริง"
  else
    log "กู้ไฟล์ MinIO เสร็จ"
  fi
}

# =============================================================================
# env — ดาวน์โหลด .env รุ่นเก่าออกมาเป็นไฟล์แยก
# =============================================================================
cmd_env() {
  check_remote
  local want=${ARGS[0]:-latest} name out
  if [[ $want == latest ]]; then
    name=$(rclone lsf "$RBASE/config" --files-only 2>/dev/null | sort | tail -n1 || true)
  else
    name=$want
  fi
  [[ -n $name ]] || die "ไม่พบไฟล์ .env สำรองบนปลายทาง"
  out=${OUT_FILE:-./restored.env}
  [[ ! -e $out ]] || die "$out มีอยู่แล้ว — จะไม่เขียนทับ (ใช้ --out ชื่อไฟล์อื่น)"
  ( umask 077; rc copyto "$RBASE/config/$name" "$out" ) || die "ดาวน์โหลดไม่สำเร็จ"
  chmod 600 "$out"
  log "บันทึกเป็น $out (สิทธิ์ 600) จาก config/$name"
  echo "ตรวจเนื้อหาแล้วค่อยคัดลอกไปเป็น $ENV_FILE เอง — สคริปต์จะไม่ทับ .env จริงให้"
}

case $CMD in
  list)  cmd_list ;;
  test)  cmd_test ;;
  db)    cmd_db ;;
  minio) cmd_minio ;;
  env)   cmd_env ;;
  *)     usage; die "ไม่รู้จักคำสั่ง '$CMD'" ;;
esac
