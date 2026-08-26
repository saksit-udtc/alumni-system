-- Merch orders now require bookerEmail and a shipping address.
-- Existing rows (placed before this requirement existed) are backfilled
-- with placeholders so the columns can become NOT NULL without breaking
-- past order history; the app enforces both as required on every new order.

ALTER TABLE "MerchOrder" ADD COLUMN "shippingAddress" TEXT;

UPDATE "MerchOrder" SET "bookerEmail" = 'ไม่มีข้อมูล' WHERE "bookerEmail" IS NULL;
UPDATE "MerchOrder" SET "shippingAddress" = 'ไม่มีข้อมูล (สั่งซื้อก่อนเปิดใช้งานฟิลด์ที่อยู่จัดส่ง)' WHERE "shippingAddress" IS NULL;

ALTER TABLE "MerchOrder" ALTER COLUMN "bookerEmail" SET NOT NULL;
ALTER TABLE "MerchOrder" ALTER COLUMN "shippingAddress" SET NOT NULL;
