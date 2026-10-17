-- ที่อยู่จัดส่งแบบแยกช่อง (รองรับการเชื่อมต่อขนส่ง เช่น Flash Express) — nullable: ออเดอร์เก่า/ออเดอร์รับที่วิทยาลัยไม่มีค่า
-- ช่อง shippingAddress เดิมยังเก็บข้อความที่อยู่รวมไว้เหมือนเดิม
ALTER TABLE "MerchOrder" ADD COLUMN "addrLine" TEXT;
ALTER TABLE "MerchOrder" ADD COLUMN "addrSubdistrict" TEXT;
ALTER TABLE "MerchOrder" ADD COLUMN "addrDistrict" TEXT;
ALTER TABLE "MerchOrder" ADD COLUMN "addrProvince" TEXT;
ALTER TABLE "MerchOrder" ADD COLUMN "addrPostcode" TEXT;
