-- ออเดอร์รับสินค้าที่วิทยาลัย: บันทึกว่าลูกค้ามารับแล้วเมื่อไหร่ / ใครกดยืนยัน
ALTER TABLE "MerchOrder"
  ADD COLUMN "pickedUpAt" TIMESTAMP(3),
  ADD COLUMN "pickedUpBy" TEXT;
