-- ขายหน้างาน: เพิ่มสถานะ "รอชำระ" สำหรับโอนเงิน (กันสต๊อกไว้จนผู้ขายกดยืนยันรับเงิน)
-- ใบขายเดิมทั้งหมดถือว่า paid (default) และ paidAt = เวลาที่ขาย
CREATE TYPE "PosSaleStatus" AS ENUM ('pending', 'paid', 'cancelled');

ALTER TABLE "PosSale"
  ADD COLUMN "status" "PosSaleStatus" NOT NULL DEFAULT 'paid',
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "holdUntil" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelReason" TEXT;

UPDATE "PosSale" SET "paidAt" = "createdAt";

CREATE INDEX "PosSale_status_holdUntil_idx" ON "PosSale"("status", "holdUntil");
