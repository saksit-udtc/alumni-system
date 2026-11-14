-- สมุดบัญชีรายวัน: เพิ่มช่อง "หมวดงาน" ให้รายการที่กรอกเอง (คอลัมน์ใหม่ในตาราง LedgerEntry เท่านั้น)
-- รายการเดิมถือเป็น 'general' — ย้อนกลับได้ด้วย: ALTER TABLE "LedgerEntry" DROP COLUMN "stream";
ALTER TABLE "LedgerEntry" ADD COLUMN "stream" TEXT NOT NULL DEFAULT 'general';
