# ระบบสำรองข้อมูลอัตโนมัติ → ที่เก็บภายนอก (เข้ารหัส)

ชุดสคริปต์นี้สำรองข้อมูลของระบบคืนสู่เหย้า (Docker Compose: PostgreSQL + MinIO) ไปเก็บนอกเครื่องเซิร์ฟเวอร์ ปลายทางเลือกได้สองแบบ: **Synology NAS ของวิทยาลัย (ผ่าน SFTP — แนะนำ ดู [`NAS.md`](NAS.md))** หรือ Google Drive (ข้อ 2–3 ด้านล่าง)
**ไม่แตะโค้ดของแอปเลย** — อยู่ในโฟลเดอร์ `backup/` แยกต่างหาก และทำงานผ่าน `docker compose` / `rclone` เท่านั้น

| ไฟล์ | หน้าที่ |
|---|---|
| `backup.sh` | สำรองฐานข้อมูล + ไฟล์ MinIO ทุก bucket + `.env` แล้วส่งไปปลายทาง (เข้ารหัส) พร้อมลบของเก่าตามนโยบาย |
| `restore.sh` | ดูรายการ / ทดสอบกู้คืน / กู้ฐานข้อมูล / กู้ไฟล์ MinIO / ดึง `.env` เก่า |
| `common.sh` | ฟังก์ชันที่สองสคริปต์ใช้ร่วมกัน (ไม่ต้องรันเอง) |
| `backup.env.example` | ตัวอย่างไฟล์ตั้งค่า → คัดลอกเป็น `backup.env` |
| `crontab.example` | ตัวอย่างตารางเวลาสำรองอัตโนมัติ |
| `NAS.md` | **ตั้งค่าปลายทางเป็น Synology NAS** (เตรียม DSM, SFTP, rclone, snapshot, สำรองต่อออกนอกอาคาร) |
| `RESTORE.md` | **คู่มือกู้คืน** ทุกกรณี (อ่านไว้ก่อนวันที่จะต้องใช้จริง) |

## สำรองอะไร เก็บไว้ที่ไหน

```
ปลายทาง: Synology NAS (โฟลเดอร์ alumni-backup/data) หรือ Google Drive (โฟลเดอร์ udtc-alumni-backup)
ทุกชื่อไฟล์/โฟลเดอร์ถูกเข้ารหัส เปิดดูบน NAS/เว็บ Drive แล้วอ่านไม่ออก
└── (โฟลเดอร์ที่ชี้จาก remote nas-crypt หรือ gdrive-crypt)
    └── alumni/                    ← REMOTE_PATH
        ├── db/                    dump ฐานข้อมูลรายวัน (เก็บ 30 วัน อย่างน้อย 7 ไฟล์ล่าสุด)
        ├── monthly/               dump รายเดือน 1 ไฟล์/เดือน (เก็บ 6 เดือน)
        ├── minio/<bucket>/        ไฟล์ทุก bucket (สลิป, รูปสินค้า, แบนเนอร์, ผังโต๊ะ ...) แบบ mirror
        ├── minio-deleted/<เวลา>/  ไฟล์ที่ถูกลบหรือถูกทับใน MinIO — พักไว้ 30 วันก่อนลบจริง
        └── config/                .env (เฉพาะเมื่อมีการเปลี่ยนแปลง)
```

สำเนาล่าสุดของ dump ฐานข้อมูลยังอยู่ในเครื่องเซิร์ฟเวอร์ที่ `/opt/backups/alumni/db/` (7 วัน) ด้วย

**ข้อกำหนดด้านความปลอดภัยที่สคริปต์บังคับให้:** ปลายทางต้องเป็น remote แบบ `crypt` (เข้ารหัสฝั่งเครื่องเราก่อนส่งออก)
เพราะข้อมูลมีชื่อ เบอร์โทร และสลิปโอนเงินของศิษย์เก่า ถ้าไม่เข้ารหัสสคริปต์จะไม่ทำงาน

## ติดตั้งบนเซิร์ฟเวอร์ (ทำครั้งเดียว ประมาณ 30–45 นาที)

### 1) ดึงสคริปต์ลงเซิร์ฟเวอร์

```bash
cd /opt/alumni-system && git pull
ls backup/                       # ต้องเห็น backup.sh restore.sh ...
```

> **เลือก Synology NAS?** ให้ทำตาม [`NAS.md`](NAS.md) แทนข้อ 2–3 (ตั้งค่า NAS + rclone + `nas-crypt`) แล้วกลับมาทำข้อ 4 เป็นต้นไปตามเดิม
> ข้อ 2–3 ด้านล่างใช้เมื่อเลือก Google Drive เท่านั้น

### 2) ติดตั้ง rclone และเชื่อมต่อ Google Drive (เฉพาะกรณีใช้ Drive)

```bash
curl https://rclone.org/install.sh | sudo bash
rclone version                   # ควรเป็นรุ่น 1.60 ขึ้นไป
```

**2.1 สร้าง OAuth Client ของวิทยาลัยเอง (แนะนำ)** — ถ้าใช้ client กลางของ rclone จะถูกจำกัดโควตาร่วมกับคนทั้งโลก และช้า/ล้มบ่อย

1. เข้า <https://console.cloud.google.com> ด้วยบัญชีที่จะเก็บสำรอง → สร้างโปรเจกต์ใหม่ (เช่น `alumni-backup`)
2. **APIs & Services → Library** → ค้นหา **Google Drive API** → Enable
3. **OAuth consent screen**
   - ถ้าเป็นบัญชี Google Workspace ของวิทยาลัย: เลือก User type = **Internal** (ดีที่สุด — token ไม่หมดอายุ)
   - ถ้าเป็น Gmail ธรรมดา: เลือก **External** แล้วกด **Publish app** ให้เป็น *In production*
     **ห้ามปล่อยเป็น Testing** เพราะ token จะหมดอายุใน 7 วัน และการสำรองจะหยุดเงียบ ๆ
4. **Credentials → Create credentials → OAuth client ID → Desktop app** → จดค่า **Client ID** และ **Client secret**

> ใช้บัญชีกลางของหน่วยงาน (ไม่ผูกกับตัวบุคคล) เพราะถ้าเจ้าของบัญชีย้าย/ลาออกแล้วบัญชีถูกปิด การสำรองจะหยุดทันที

**2.2 สร้าง remote ชื่อ `gdrive`** (บนเซิร์ฟเวอร์ที่จะรันสำรอง ด้วยผู้ใช้ที่จะให้ cron ใช้ — ปกติคือ root)

```bash
rclone config
```

ตอบตามลำดับ: `n` (New remote) → name: `gdrive` → Storage: `drive` (Google Drive) → client_id / client_secret: วางค่าจากข้อ 2.1 →
scope: เลือกตามตารางด้านล่าง → service_account_file: ว่าง → Edit advanced config: `n` →
**Use web browser to automatically authenticate? → `n`** (เซิร์ฟเวอร์ไม่มีเบราว์เซอร์)

| scope | เหมาะกับ |
|---|---|
| `1` full access | บัญชีที่ใช้เก็บสำรองอย่างเดียว — กู้บนเครื่องใหม่ง่ายที่สุด |
| `3` drive.file | บัญชีที่มีไฟล์อื่นปนอยู่ด้วย — rclone เห็นเฉพาะไฟล์ที่ตัวเองสร้าง **แต่ต้องเก็บ client_id/secret เดิมไว้ให้ดี** ไม่งั้นกู้บนเครื่องใหม่จะมองไม่เห็นไฟล์เดิม |

ขั้นตอนนี้ rclone จะพิมพ์คำสั่งหน้าตาแบบ `rclone authorize "drive" "eyJ..."` ให้ → นำคำสั่งนั้นไปรันบน **เครื่องที่มีเบราว์เซอร์**
(เช่น Windows ของครู ติดตั้ง rclone ด้วย `winget install Rclone.Rclone`) → ล็อกอินบัญชี Google → คัดลอกข้อความ token ที่ได้ กลับมาวางที่เซิร์ฟเวอร์ →
Shared Drive: `n` → `y` ยืนยัน → `q`

ทดสอบ: `rclone lsd gdrive:` ต้องไม่ error

### 3) สร้าง remote เข้ารหัส `gdrive-crypt` (เฉพาะกรณีใช้ Drive)

```bash
rclone config
```

`n` → name: `gdrive-crypt` → Storage: `crypt` → remote: `gdrive:udtc-alumni-backup` →
filename_encryption: `standard` → directory_name_encryption: `true` →
Password: เลือก `g` (generate) ความยาว 1024 bits → Password2 (salt): เลือก `g` เช่นกัน → `y` → `q`

> ### ⚠️ สำคัญที่สุดของทั้งชุด
> รหัสผ่านสองตัวใน `gdrive-crypt` **ไม่สามารถกู้คืนได้** ถ้าหาย ข้อมูลบน Drive ทั้งหมดจะถอดรหัสไม่ได้อีกตลอดไป (ไม่มีใครช่วยกู้ให้ได้ รวมถึง Google)
> ให้ทำทันที:
> 1. รัน `rclone config file` เพื่อดูตำแหน่งไฟล์ `rclone.conf`
> 2. คัดลอกไฟล์นั้นเก็บไว้ **อย่างน้อย 2 แห่งที่อยู่นอกเซิร์ฟเวอร์** (เช่น ตัวจัดการรหัสผ่านของหน่วยงาน, แฟลชไดรฟ์ในตู้เซฟ)
>    ไฟล์นี้มีทั้ง token ของ Drive, client_id/secret และรหัส crypt — เก็บเหมือนกุญแจห้องเซิร์ฟเวอร์
> 3. `chmod 600 ~/.config/rclone/rclone.conf`
> 4. ให้ผู้ดูแลระบบอย่างน้อย 2 คนรู้ว่าไฟล์นี้อยู่ที่ไหน

### 4) ตั้งค่าสคริปต์

```bash
cd /opt/alumni-system/backup
cp backup.env.example backup.env
chmod 600 backup.env
nano backup.env                  # ปกติแก้แค่ RCLONE_REMOTE (nas-crypt หรือ gdrive-crypt) / MINIO_ENDPOINT ถ้าต่างจากค่าเริ่มต้น
```

รหัสผ่านฐานข้อมูลและ MinIO ไม่ต้องกรอก — สคริปต์อ่านจาก `/opt/alumni-system/.env` เอง
(ตรวจว่า `MINIO_ENDPOINT` ตรงกับพอร์ตที่ `docker-compose.yml` เปิดไว้ ปัจจุบันคือ `127.0.0.1:9002`)

### 5) ทดสอบทีละขั้น

```bash
bash backup.sh --check           # ตรวจความพร้อม: docker, postgres, MinIO, ปลายทาง, การเข้ารหัส
bash backup.sh                   # สำรองจริงครั้งแรก (ดูผลใน terminal)
bash restore.sh list             # ต้องเห็น dump, bucket, .env ที่เพิ่งสำรอง
bash restore.sh test             # ทดลองกู้ลงฐานข้อมูลชั่วคราว ต้องเห็นจำนวนแถวแต่ละตาราง
```

เปิดดูโฟลเดอร์ปลายทาง (File Station บน NAS หรือเว็บ Google Drive) ต้องเห็นชื่อไฟล์เป็นตัวอักษรสุ่มอ่านไม่ออก = เข้ารหัสสำเร็จ

### 6) ตั้งเวลาอัตโนมัติ

```bash
sudo cp /opt/alumni-system/backup/crontab.example /etc/cron.d/alumni-backup
sudo nano /etc/cron.d/alumni-backup     # ตรวจ path/ผู้ใช้ แล้วเลือกบรรทัดที่ต้องการ
sudo chmod 644 /etc/cron.d/alumni-backup
```

ค่าเริ่มต้น: สำรองเต็มทุกวันตอนกลางคืน (02:30 น. เวลาไทย) — หมายความว่าถ้าเครื่องพัง ข้อมูลอาจหายได้สูงสุดประมาณ 24 ชั่วโมง

> **⚠️ ระวังเรื่องเขตเวลา:** cron ใช้เวลาของเครื่องเซิร์ฟเวอร์ ตรวจก่อนด้วย `timedatectl | grep "Time zone"`
> - เซิร์ฟเวอร์ qa-ems ตั้งเป็น **Etc/UTC** (ช้ากว่าเวลาไทย 7 ชั่วโมง) ถ้าเขียน `30 2 * * *` จะรันตอน 09:30 น. เวลาไทย (ช่วงมีผู้ใช้) — `crontab.example` จึงเขียนเวลาเป็น UTC ไว้ให้แล้ว
>   คือ **`30 19 * * *`** (= 02:30 น. ไทย) สำหรับสำรองรายวัน และ **`0 21 1 * *`** (= 04:00 น. ไทยของวันที่ 2) สำหรับทดสอบกู้รายเดือน
> - ถ้าเครื่องของคุณตั้งเป็น Asia/Bangkok ให้แก้กลับเป็น `30 2 * * *` และ `0 4 1 * *` (มีคอมเมนต์กำกับในไฟล์)
> - ชื่อไฟล์ dump และเวลาใน `backup.log` ใช้เวลาเดียวกับเครื่อง (UTC) เช่น `alumni_db_20260920_193001` = 02:30 น. เวลาไทยของวันที่ 21 ไม่กระทบนโยบายเก็บ/ลบของเก่า เพราะอ่านวันที่จากชื่อไฟล์ด้วยเวลาเดียวกันทั้งหมด
ช่วงเปิดจองโต๊ะหรือใกล้วันงานควรเปิดบรรทัด `--db-only` ทุก 2 ชั่วโมงเพิ่ม (มีตัวอย่างใน crontab.example)

### 7) (แนะนำ) ให้มีคนรู้เมื่อการสำรองหยุดทำงาน

สคริปต์ที่พังเงียบ ๆ อันตรายกว่าไม่มีสคริปต์ เพราะทุกคนคิดว่าปลอดภัยอยู่
สมัคร <https://healthchecks.io> (ฟรี) สร้าง check ให้ Period = 1 วัน, Grace = 2 ชั่วโมง แล้วใส่ ping URL ที่ `HC_PING_URL` ใน `backup.env`
ถ้าสำรองล้มเหลวหรือไม่ทำงานตามเวลา จะแจ้งเตือนทางอีเมล/Telegram/Discord/Slack ตามที่ตั้งไว้ (สคริปต์แนบท้าย log ไปกับการแจ้ง `/fail` ให้ด้วย)

## ใช้งานประจำ

```bash
bash backup/backup.sh --label pre-deploy     # สำรองทันทีก่อนอัปเดตระบบ (ก่อน docker compose build/up)
cat /opt/backups/alumni/last_success         # เวลาที่สำรองสำเร็จล่าสุด
tail -n 40 /opt/backups/alumni/backup.log    # ดู log
bash backup/restore.sh list                  # ดูสิ่งที่มีบนปลายทาง
rclone about nas:                            # พื้นที่ที่เหลือ (NAS/SFTP บางรุ่นไม่รองรับ → ดูใน DSM แทน; ถ้าใช้ Drive ให้ใช้ gdrive:)
```

**ตารางตรวจสอบที่แนะนำ:** เดือนละครั้งรัน `restore.sh test` (มีตัวอย่าง cron ให้) และปีละสองครั้งลองกู้บนเครื่องอื่นตามหัวข้อ "เครื่องเซิร์ฟเวอร์พังทั้งเครื่อง" ใน `RESTORE.md`

## ข้อควรรู้และข้อจำกัด

- **ไม่ได้สำรอง**: Docker image (สร้างใหม่จาก repo ได้), การตั้งค่า **Cloudflare Tunnel** บนเครื่อง host (`/etc/cloudflared/` หรือ `~/.cloudflared/` รวมถึงไฟล์ credentials ของ tunnel)
  และการตั้งค่าอื่นนอก Docker — ควรเก็บสำเนาแยกต่างหากเอง
- **พื้นที่**: dump ฐานข้อมูลมีขนาดเล็ก ส่วนที่โตคือสลิปและรูปใน MinIO และหลังลบ/ทับไฟล์จะกินพื้นที่เพิ่มในโฟลเดอร์ `minio-deleted` อีก 30 วัน
  ตรวจพื้นที่ว่างของ NAS ใน DSM (Storage Manager) หรือโควตาบัญชี Drive ด้วย `rclone about gdrive:`
- **ความสอดคล้องระหว่างฐานข้อมูลกับไฟล์**: สองส่วนสำรองไม่ได้พร้อมกันเป๊ะ (ห่างกันไม่กี่วินาที–นาที) การกู้แบบปกติของ `restore.sh minio` เป็นการ "เพิ่มเติม" ไม่ลบไฟล์ที่มีอยู่ จึงปลอดภัย
- **ผู้ดูแลระบบสูงสุด** ควรได้รับแจ้งว่ามีสำเนาข้อมูลส่วนบุคคลอยู่บนที่เก็บสำรอง (NAS/Google Drive — เข้ารหัสไว้) ให้สอดคล้องกับประกาศ/นโยบายคุ้มครองข้อมูลส่วนบุคคล (PDPA) ของวิทยาลัย
- สคริปต์ผ่านการทดสอบในสภาพแวดล้อมจำลอง (PostgreSQL 16 จริง + rclone เข้ารหัสจริง แต่ MinIO, Synology NAS และ Google Drive จำลองด้วยโฟลเดอร์/SFTP server ในเครื่อง) — **การรันครั้งแรกบนเซิร์ฟเวอร์จริงจึงต้องทำตามข้อ 5 ทีละขั้นและตรวจผลเอง**

## แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `couldn't find section in config file` (ตอนรันจาก cron) | cron หา `rclone.conf` ไม่เจอ → ตั้ง `RCLONE_CONFIG=` ใน crontab หรือ `backup.env` ให้ชี้ไฟล์ที่ถูกต้อง |
| `invalid_grant` / `token expired` | token หมดอายุ (มักเกิดเมื่อ OAuth app ยังเป็น Testing) → แก้ตามข้อ 2.1 ข้อ 3 แล้วรัน `rclone config reconnect gdrive:` |
| `rateLimitExceeded` / `userRateLimitExceeded` | ใช้ client กลางของ rclone → สร้าง OAuth client เองตามข้อ 2.1 หรือลด `--transfers` ใน `RCLONE_FLAGS` |
| `storageQuotaExceeded` | Drive เต็ม → ล้างพื้นที่/ขอโควตาเพิ่ม หรือลด `KEEP_REMOTE_DAYS` |
| `เชื่อมต่อ MinIO ที่ ... ไม่ได้` | `MINIO_ENDPOINT` ไม่ตรงกับพอร์ตใน `docker-compose.yml`, container minio ไม่ทำงาน หรือรหัสผ่านใน `.env` ไม่ตรงกับที่ MinIO ใช้อยู่จริง |
| สำรองรันตอนกลางวัน/ผิดเวลาจากที่ตั้งใจ | เขตเวลาของเครื่องเป็น UTC → แก้เวลาใน `/etc/cron.d/alumni-backup` ตามหมายเหตุเรื่องเขตเวลาในข้อ 6 |
| `permission denied ... docker.sock` | ผู้ใช้ที่รันไม่มีสิทธิ์ docker → รันด้วย root หรือเพิ่มเข้ากลุ่ม `docker` |
| `มีการสำรองอีกรอบกำลังทำงานอยู่` | รอบก่อนยังไม่จบ (หรือกำลังรันมือ) — ปกติ ไม่ต้องทำอะไร ถ้าค้างเป็นชั่วโมงให้ตรวจ `pgrep -af backup.sh` |
