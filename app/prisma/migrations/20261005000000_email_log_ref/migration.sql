-- ผูกแถว log เมลกับออเดอร์/การจอง (orderCode หรือ bookingCode) เพื่อให้ส่งซ้ำจากหน้า log ได้
ALTER TABLE "EmailLog" ADD COLUMN "ref" TEXT;
CREATE INDEX "EmailLog_ref_idx" ON "EmailLog"("ref");
