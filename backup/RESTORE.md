# คู่มือกู้คืนข้อมูล (Restore)

คู่มือนี้ใช้เมื่อข้อมูลของระบบคืนสู่เหย้าเสียหาย ถูกลบ หรือเซิร์ฟเวอร์พัง — อ่านผ่านตาไว้ก่อนวันที่จะต้องใช้จริง
คำสั่งทั้งหมดรันบนเซิร์ฟเวอร์ (`/opt/alumni-system`) ด้วยผู้ใช้เดียวกับที่ตั้งค่า rclone ไว้ (ปกติคือ root)

## เลือกกรณีของคุณ

| เกิดอะไรขึ้น | ไปที่ |
|---|---|
| อยากรู้ว่าไฟล์สำรองใช้ได้จริงไหม (ทำเป็นประจำ) | [กรณี 1](#กรณี-1--ทดสอบว่ากู้คืนได้จริง-ไม่กระทบระบบ) |
| ฐานข้อมูลเสีย / มีคนลบหรือแก้ข้อมูลผิดจำนวนมาก | [กรณี 2](#กรณี-2--กู้ฐานข้อมูลทั้งก้อนกลับไปเมื่อเวลาหนึ่ง) |
| ต้องการเฉพาะข้อมูลบางรายการ (เช่น การจอง 1 รายการที่ถูกลบ) | [กรณี 3](#กรณี-3--เอาข้อมูลบางรายการกลับมา-ไม่ย้อนทั้งระบบ) |
| สลิป/รูปใน MinIO หาย หรือถูกลบ/ทับ | [กรณี 4](#กรณี-4--กู้ไฟล์สลิป-รูปสินค้า-แบนเนอร์-ใน-minio) |
| กู้ผิดแล้วอยากย้อนกลับ | [กรณี 5](#กรณี-5--ย้อนกลับหลังจากกู้ผิด) |
| เครื่องเซิร์ฟเวอร์พังทั้งเครื่อง / ต้องย้ายไปเครื่องใหม่ | [กรณี 6](#กรณี-6--เครื่องเซิร์ฟเวอร์พังทั้งเครื่อง) |
| ไม่มีสคริปต์/สคริปต์ใช้ไม่ได้ | [กรณี 7](#กรณี-7--กู้ด้วยมือโดยไม่ใช้สคริปต์) |

**หลักคิดก่อนกู้ทุกครั้ง**

1. **หยุดก่อนคิด** — ถ้าข้อมูลเพิ่งเสียหาย อย่าเพิ่งสั่งอะไรที่เขียนทับ ระบบสำรองรอบตี 2:30 อาจทับ dump ที่ดีด้วยข้อมูลเสียได้ ถ้ากำลังตรวจสอบอยู่ให้ปิดงานตั้งเวลาชั่วคราวใน `/etc/cron.d/alumni-backup` (ใส่ `#` หน้าบรรทัด) —
   dump รายวันเก็บไว้ 30 วัน และรายเดือน 6 เดือน จึงยังมีของเก่าดี ๆ ให้ย้อนไป
2. **ข้อมูลที่เกิดหลังเวลาของไฟล์สำรองจะหายไปเมื่อกู้ทั้งก้อน** (RPO ปกติ ≤ 24 ชั่วโมง) — ถ้าต้องการรักษาข้อมูลช่วงนั้น ใช้ [กรณี 3](#กรณี-3--เอาข้อมูลบางรายการกลับมา-ไม่ย้อนทั้งระบบ)
3. คำสั่งที่ **ทับข้อมูลจริง** จะถามให้พิมพ์ยืนยัน และ `restore.sh db` จะสำรองสภาพปัจจุบันไว้ให้ก่อนเสมอ (ไฟล์ `pre_restore_*.dump.keep`)

---

## กรณี 1 — ทดสอบว่ากู้คืนได้จริง (ไม่กระทบระบบ)

```bash
cd /opt/alumni-system
bash backup/restore.sh list                 # ดูรายการสำรองบนปลายทาง
bash backup/restore.sh test                 # ทดสอบกับไฟล์ล่าสุด
bash backup/restore.sh test alumni_db_20260920_023001.dump   # หรือระบุไฟล์
```

สคริปต์จะดาวน์โหลด → ตรวจว่าอ่านได้ → กู้ลงฐานข้อมูลชั่วคราว → แสดงจำนวนแถวของทุกตาราง → ลบฐานข้อมูลชั่วคราวทิ้ง
ให้เทียบตัวเลข (เช่น จำนวนศิษย์เก่า การจอง สลิป) กับที่ควรจะเป็น ถ้าผ่าน แปลว่าไฟล์สำรองใช้กู้จริงได้

ควรทำ **เดือนละครั้ง** (ตั้งอัตโนมัติได้ ดู `crontab.example` ข้อ 3)

---

## กรณี 2 — กู้ฐานข้อมูลทั้งก้อนกลับไปเมื่อเวลาหนึ่ง

**ผลกระทบ:** ข้อมูลทั้งหมดในฐานข้อมูลจะถูกแทนที่ด้วยข้อมูล ณ เวลาของไฟล์สำรอง เว็บจะใช้งานไม่ได้ประมาณ 1–2 นาทีระหว่างกู้

1. ดูว่ามีไฟล์อะไรให้เลือก และเลือกจุดเวลาที่ต้องการ (ชื่อไฟล์ = ปีเดือนวัน_ชั่วโมงนาทีวินาที)

   ```bash
   bash backup/restore.sh list
   ```

2. (แนะนำ) ลอง `test` กับไฟล์นั้นก่อน ตามกรณี 1
3. กู้จริง

   ```bash
   bash backup/restore.sh db                                    # ใช้ไฟล์ล่าสุด
   bash backup/restore.sh db alumni_db_20260920_023001.dump     # หรือระบุไฟล์ (รายวัน หรือ รายเดือนก็ได้)
   ```

   สคริปต์จะ: ดาวน์โหลดและตรวจไฟล์ → **ให้พิมพ์ชื่อฐานข้อมูล (`alumni_homecoming`) เพื่อยืนยัน** → สำรองสภาพปัจจุบันไว้ที่
   `/opt/backups/alumni/db/pre_restore_<เวลา>.dump.keep` → หยุด `app` และ `cron` → ลบและสร้างฐานข้อมูลใหม่ → restore →
   แสดงจำนวนแถว → เปิด `app` และ `cron` กลับ (แอปจะรัน `prisma migrate deploy` เองตอนเริ่ม)

4. ตรวจผล: เข้า `/admin` ล็อกอิน ดูรายการจอง/ศิษย์เก่า/ออเดอร์ให้ตรงกับที่คาดไว้
5. ถ้าเวลาของไฟล์สำรองเก่ากว่าเหตุการณ์ในช่วงที่ผ่านมา (เช่น มีคนโอนเงินและอัปโหลดสลิปไปแล้วหลังจุดนั้น) ให้ตรวจสลิป/การจองช่วงนั้นเทียบกับ MinIO (สลิปในไฟล์ MinIO ยังอยู่ครบ เพราะกู้ฐานข้อมูลไม่ได้ลบไฟล์)
   และแจ้งผู้ที่ได้รับผลกระทบให้ยืนยันซ้ำ

**ถ้าสคริปต์แจ้งข้อผิดพลาดกลางทาง:** app/cron จะยังหยุดอยู่ ข้อความจะบอกคำสั่งย้อนกลับ (ดู[กรณี 5](#กรณี-5--ย้อนกลับหลังจากกู้ผิด)) เมื่อแก้แล้วเปิดกลับด้วย `docker compose up -d app cron`

---

## กรณี 3 — เอาข้อมูลบางรายการกลับมา (ไม่ย้อนทั้งระบบ)

เหมาะกับกรณี "มีการจอง/ออเดอร์ 1–2 รายการถูกลบหรือแก้ผิด แต่ข้อมูลอื่นที่เข้ามาหลังจากนั้นยังต้องเก็บไว้"
วิธี: กู้ไฟล์สำรองลงฐานข้อมูล **แยกอีกตัว** แล้วดึงเฉพาะแถวที่ต้องการมาใช้

```bash
cd /opt/alumni-system

# 1) ดาวน์โหลดไฟล์สำรองที่ต้องการ (ดูชื่อไฟล์จาก restore.sh list; ถ้าปลายทางเป็น Drive ใช้ gdrive-crypt แทน nas-crypt)
rclone copyto nas-crypt:alumni/db/alumni_db_20260920_023001.dump /tmp/recover.dump

# 2) สร้างฐานข้อมูลชั่วคราวชื่อ recovery แล้วกู้ลงไป (ไม่แตะฐานข้อมูลจริง)
docker compose exec -T postgres psql -U alumni -d postgres -c 'CREATE DATABASE recovery'
docker compose exec -T postgres pg_restore -U alumni -d recovery --no-owner --no-acl < /tmp/recover.dump

# 3) ค้นหาแถวที่ต้องการ (ตัวอย่าง — ชื่อตาราง/คอลัมน์ให้ตรวจจาก prisma/schema.prisma)
docker compose exec postgres psql -U alumni -d recovery \
  -c "SELECT * FROM \"Reservation\" WHERE \"bookingCode\" = 'AB12CD'"

# 4) ส่งออกแถวนั้นเป็น SQL แล้วนำเข้าฐานข้อมูลจริง (ตรวจไฟล์ .sql ด้วยตาก่อนนำเข้าเสมอ)
docker compose exec -T postgres pg_dump -U alumni -d recovery --data-only --inserts \
  --table='"Reservation"' > /tmp/recover_rows.sql
#    แก้ไฟล์ /tmp/recover_rows.sql ให้เหลือเฉพาะ INSERT ของแถวที่ต้องการ แล้ว:
docker compose exec -T postgres psql -U alumni -d alumni_homecoming < /tmp/recover_rows.sql

# 5) ลบของชั่วคราว
docker compose exec -T postgres psql -U alumni -d postgres -c 'DROP DATABASE recovery'
rm -f /tmp/recover.dump /tmp/recover_rows.sql
```

ข้อควรระวัง: ตารางมีความสัมพันธ์กัน (เช่น การจองอ้างถึงโต๊ะ/ศิษย์เก่า) แถวที่นำเข้าต้องมีข้อมูลที่อ้างถึงอยู่ในฐานข้อมูลจริงด้วย
และค่า `id` ต้องไม่ชนกับแถวที่มีอยู่ — ถ้าไม่มั่นใจ ให้ **สำรองก่อนแก้** ด้วย `bash backup/backup.sh --db-only --label before-fix`

---

## กรณี 4 — กู้ไฟล์ (สลิป, รูปสินค้า, แบนเนอร์) ใน MinIO

`restore.sh minio` ค่าเริ่มต้นเป็นการ **คัดลอกเพิ่ม** ไม่ลบอะไรที่มีอยู่ใน MinIO ตอนนี้ จึงปลอดภัย

```bash
bash backup/restore.sh minio --dry-run                 # ดูก่อนว่าจะคัดลอกอะไรบ้าง (ยังไม่ทำจริง)
bash backup/restore.sh minio all                       # กู้ทุก bucket
bash backup/restore.sh minio payment-slips             # กู้เฉพาะ bucket สลิป
bash backup/restore.sh minio payment-slips --mirror    # ให้ตรงกับไฟล์สำรองเป๊ะ (ไฟล์ที่ "เกิน" ใน MinIO จะถูกลบ — ต้องพิมพ์ MIRROR ยืนยัน)
```

สคริปต์จะรัน `minio-init` ให้ด้วย เพื่อสร้าง bucket และตั้ง policy สาธารณะ (อ่านได้อย่างเดียว) ของ `floor-plans`, `merch-products`, `home-banners`,
`landing-gallery`, `landing-assets` ให้เหมือนเดิม ส่วน `payment-slips` เป็นส่วนตัวเสมอ

### กู้ไฟล์ที่ถูก "ลบ" หรือ "ทับ" ไปแล้ว (ยังไม่เกิน 30 วัน)

เมื่อไฟล์หายไปจาก MinIO การสำรองรอบถัดไปจะ **ย้าย** สำเนาบนปลายทางไปพักที่ `minio-deleted/<เวลา>/<bucket>/` แทนการลบ (ไฟล์ที่ถูกทับก็เช่นกัน — เก็บรุ่นก่อนทับไว้)

```bash
# 1) หาไฟล์ที่ต้องการ
rclone lsf -R nas-crypt:alumni/minio-deleted | grep -i slip

# 2) คัดลอกกลับเข้า "ชุดสำรองหลัก" ของ bucket นั้น ด้วยชื่อเดิม
rclone copyto nas-crypt:alumni/minio-deleted/20260920_023001/payment-slips/slip2.jpg \
              nas-crypt:alumni/minio/payment-slips/slip2.jpg

# 3) กู้เข้า MinIO (ห้ามข้ามข้อนี้ และห้ามปล่อยให้ตี 2:30 ทำงานก่อน ไม่งั้นรอบสำรองถัดไปจะย้ายไฟล์นี้ไปพักอีกครั้ง เพราะใน MinIO ยังไม่มี)
bash backup/restore.sh minio payment-slips
```

---

## กรณี 5 — ย้อนกลับหลังจากกู้ผิด

`restore.sh db` สำรองสภาพก่อนกู้ไว้ที่ `/opt/backups/alumni/db/pre_restore_<เวลา>.dump.keep` เสมอ (ไฟล์กลุ่มนี้ **ไม่ถูกลบอัตโนมัติ**)

```bash
ls -l /opt/backups/alumni/db/pre_restore_*
bash backup/restore.sh db /opt/backups/alumni/db/pre_restore_20260920_101500.dump.keep
```

ใส่ path ไฟล์ในเครื่องแทนชื่อไฟล์บนปลายทางได้ตรง ๆ — ขั้นตอนเหมือนกรณี 2 ทุกประการ
เมื่อยืนยันแล้วว่าไม่ต้องใช้ ค่อยลบไฟล์ `.keep` เก่าทิ้งเองเพื่อคืนพื้นที่

---

## กรณี 6 — เครื่องเซิร์ฟเวอร์พังทั้งเครื่อง

เป้าหมาย: ตั้งระบบขึ้นใหม่บนเครื่องเปล่าให้ได้ข้อมูลล่าสุดจากปลายทางสำรองประมาณ 1–2 ชั่วโมง ถ้าเตรียมของครบ

**ของที่ต้องมีอยู่นอกเครื่องพังแล้ว (ตรวจตอนนี้เลย ก่อนถึงวันเกิดเหตุ):**

- [ ] ไฟล์ `rclone.conf` (มีรหัสผ่านเข้า NAS หรือ token Drive + รหัส crypt) — ดู NAS.md / README ข้อ 3
- [ ] สิทธิ์เข้าที่เก็บสำรอง: NAS ต้องยังเปิดอยู่และเข้าถึงได้จากเครื่องใหม่ (DSM firewall อนุญาต IP ของเครื่องใหม่แล้ว) / หรือบัญชี Google ที่เก็บสำรอง
- [ ] สิทธิ์เข้า GitHub repo `saksit-udtc/alumni-system` (สำหรับ clone โค้ด)
- [ ] ข้อมูลการตั้งค่า Cloudflare Tunnel (credentials/config ของ `cloudflared`) หรือสิทธิ์เข้า Cloudflare เพื่อสร้าง tunnel ใหม่ — สคริปต์นี้ **ไม่ได้สำรอง** ส่วนนี้

**ขั้นตอน**

1. **เตรียมเครื่องใหม่**: ติดตั้ง Ubuntu Server, Docker Engine + Docker Compose plugin, git, curl
2. **ดึงโค้ด**

   ```bash
   sudo mkdir -p /opt && cd /opt
   sudo git clone https://github.com/saksit-udtc/alumni-system.git alumni-system
   cd alumni-system
   ```

3. **ติดตั้ง rclone และนำการตั้งค่าเดิมกลับมา**

   ```bash
   curl https://rclone.org/install.sh | sudo bash
   mkdir -p ~/.config/rclone && nano ~/.config/rclone/rclone.conf    # วางเนื้อหา rclone.conf เดิมที่เก็บสำรองไว้
   chmod 600 ~/.config/rclone/rclone.conf
   rclone lsd nas:                                                     # ต้องไม่ error (ถ้าใช้ Drive: rclone lsd gdrive:)
   ```

   > **ปลายทางเป็น NAS และ `rclone.conf` หาย:** สร้าง remote `nas` (sftp) ใหม่ด้วย user/รหัสผ่านของบัญชีสำรองบน NAS แล้วสร้าง `nas-crypt`
   > ชนิด `crypt` ชี้ `nas:/alumni-backup/data` โดยกรอกรหัสผ่านและ salt **ตัวเดิม** เอง (ไม่ใช้ generate) — รายละเอียดใน NAS.md ข้อ 4
   > (ถ้าเครื่องใหม่มี IP ต่างจากเดิม ต้องเพิ่ม IP ใหม่ใน DSM Firewall ก่อน)
   >
   > **ปลายทางเป็น Drive และ `rclone.conf` หาย:** ถ้ายังจำรหัสผ่าน crypt ทั้งสองตัวได้: สร้าง `gdrive` ใหม่ (ถ้าเคยใช้ scope `drive.file` ต้องใช้ client_id/secret ชุดเดิม)
   > แล้วสร้าง `gdrive-crypt` ใหม่ชนิด `crypt` ชี้ `gdrive:udtc-alumni-backup` โดยเลือกกรอกรหัสผ่านและ salt **ตัวเดิม** เอง (ไม่ใช้ generate)
   >
   > ถ้ามองไฟล์บน Drive ไม่เห็นเลย: ดาวน์โหลดโฟลเดอร์ `udtc-alumni-backup` ผ่านหน้าเว็บ Drive มาไว้ในเครื่อง แล้วสร้าง remote `crypt` ที่ชี้ไปยังโฟลเดอร์ในเครื่องนั้นด้วยรหัสผ่านเดิม ก็ถอดรหัสได้เช่นกัน

4. **ดึง `.env` เดิมกลับมา**

   ```bash
   cp backup/backup.env.example backup/backup.env      # ค่าเริ่มต้น RCLONE_REMOTE=nas-crypt — ถ้าใช้ Drive ให้แก้เป็น gdrive-crypt
   bash backup/restore.sh env --out /root/restored.env      # ขึ้นเตือนว่าไม่พบ .env ได้ตามปกติ
   less /root/restored.env                                    # ตรวจเนื้อหา
   cp /root/restored.env /opt/alumni-system/.env && chmod 600 /opt/alumni-system/.env
   ```

   > ถ้าไม่มี `.env` สำรอง (เพิ่งเริ่มใช้สคริปต์ยังไม่ถึงรอบแรก) ต้องสร้างเองจาก `.env.example` — `JWT_SECRET` ใหม่จะทำให้ทุกคนต้องล็อกอินใหม่ ส่วน `POSTGRES_PASSWORD`/`MINIO_ROOT_*` ตั้งใหม่ได้เพราะเป็นระบบเปล่า
   > แต่ค่า `EASYSLIP_API_KEY`, `RESEND_API_KEY`, SMTP ต้องหาจากผู้ให้บริการเอง

5. **สร้างระบบเปล่าขึ้นมาก่อน**

   ```bash
   docker compose up -d --build
   docker compose ps          # postgres, minio ต้อง healthy; minio-init จะ exit 0; app ขึ้นได้แม้ฐานข้อมูลยังว่าง
   ```

6. **กู้ฐานข้อมูล** (พิมพ์ชื่อฐานข้อมูลยืนยัน)

   ```bash
   bash backup/restore.sh list
   bash backup/restore.sh db
   ```

7. **กู้ไฟล์ MinIO**

   ```bash
   bash backup/restore.sh minio all
   ```

8. **เปิดทางเข้าเว็บ**: ตั้ง `cloudflared` / tunnel ให้ชี้มาที่เครื่องใหม่ (พอร์ตของ app คือ `127.0.0.1:3001` ตาม `docker-compose.yml`) แล้วอัปเดต `APP_BASE_URL` / `MINIO_PUBLIC_URL` ใน `.env` หากโดเมนหรือ URL เปลี่ยน
   จากนั้น `docker compose up -d app`
9. **ทดสอบใช้งานจริง**: ล็อกอิน `/admin`, เปิดรายการจอง, เปิดสลิปของรายการหนึ่ง (ต้องแสดงรูปได้), เปิดหน้าแรก/ผังโต๊ะ, ลองอัปโหลดสลิปทดสอบ
10. **ตั้งระบบสำรองบนเครื่องใหม่อีกครั้ง**: `bash backup/backup.sh --check` แล้ว `sudo cp backup/crontab.example /etc/cron.d/alumni-backup` ตาม README ข้อ 6
    และรัน `bash backup/backup.sh` ทันทีหนึ่งรอบเพื่อยืนยันว่าเครื่องใหม่สำรองได้

---

## กรณี 7 — กู้ด้วยมือโดยไม่ใช้สคริปต์

ต้องการแค่ `rclone` (ที่ตั้งค่า `nas-crypt` หรือ `gdrive-crypt` แล้ว — ตัวอย่างด้านล่างใช้ `nas-crypt`) และ `docker compose`

```bash
# ดูรายการ
rclone lsf nas-crypt:alumni/db
rclone lsf nas-crypt:alumni/monthly

# ฐานข้อมูล
rclone copyto nas-crypt:alumni/db/<ชื่อไฟล์>.dump /tmp/restore.dump
docker compose stop app cron
docker compose exec -T postgres psql -U alumni -d postgres \
  -c 'DROP DATABASE IF EXISTS "alumni_homecoming" WITH (FORCE)' \
  -c 'CREATE DATABASE "alumni_homecoming" OWNER "alumni"'
docker compose exec -T postgres pg_restore -U alumni -d alumni_homecoming --no-owner --no-acl < /tmp/restore.dump
docker compose up -d app cron

# ไฟล์ MinIO (ตัวอย่าง bucket สลิป) — ตั้งปลายทาง MinIO ชั่วคราวผ่านตัวแปรแวดล้อม (ใช้ user/password จาก .env)
export RCLONE_CONFIG_MINIOSRC_TYPE=s3 RCLONE_CONFIG_MINIOSRC_PROVIDER=Minio \
       RCLONE_CONFIG_MINIOSRC_ENDPOINT=http://127.0.0.1:9002 \
       RCLONE_CONFIG_MINIOSRC_ACCESS_KEY_ID=<MINIO_ROOT_USER> \
       RCLONE_CONFIG_MINIOSRC_SECRET_ACCESS_KEY=<MINIO_ROOT_PASSWORD>
rclone copy nas-crypt:alumni/minio/payment-slips miniosrc:payment-slips
```

(ถ้าชื่อผู้ใช้/ฐานข้อมูลใน `.env` ต่างจาก `alumni` / `alumni_homecoming` ให้แทนค่าตามจริง)

---

## หลังกู้เสร็จทุกกรณี

- [ ] ล็อกอิน `/admin` ได้ และตัวเลขรวมสมเหตุสมผล
- [ ] เปิดสลิปของรายการล่าสุดได้ (แสดงรูป)
- [ ] เว็บหน้าแรก/ผังโต๊ะ/หน้าจองแสดงผลปกติ
- [ ] `docker compose ps` — ทุกบริการ `Up`
- [ ] เปิดงานตั้งเวลาสำรองกลับ (ถ้าเคยใส่ `#` ปิดไว้) และรัน `bash backup/backup.sh` ยืนยันหนึ่งรอบ
- [ ] บันทึกเหตุการณ์: เกิดอะไร กู้จากไฟล์ไหน ข้อมูลช่วงไหนอาจหาย และแจ้งผู้เกี่ยวข้อง
  (ถ้าเหตุเกี่ยวกับข้อมูลรั่วไหลหรือถูกเข้าถึงโดยไม่ได้รับอนุญาต ให้แจ้งผู้รับผิดชอบด้าน PDPA ของวิทยาลัยด้วย)
