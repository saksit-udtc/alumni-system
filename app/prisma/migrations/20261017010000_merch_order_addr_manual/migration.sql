-- ที่อยู่ที่ผู้สั่งกรอกเอง (ไม่พบในรายการเลือก) — ให้เจ้าหน้าที่ตรวจก่อนส่ง
ALTER TABLE "MerchOrder" ADD COLUMN "addrManual" BOOLEAN NOT NULL DEFAULT false;
