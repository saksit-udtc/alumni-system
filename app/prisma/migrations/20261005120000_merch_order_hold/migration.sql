-- กันสต็อกของที่ระลึกตอนยังไม่แนบสลิป: เวลาสิ้นสุดการกัน (null = ไม่หมดเวลา)
ALTER TABLE "MerchOrder" ADD COLUMN "reservedUntil" TIMESTAMP(3);
CREATE INDEX "MerchOrder_paymentStatus_reservedUntil_idx" ON "MerchOrder"("paymentStatus", "reservedUntil");
