-- Allow deleting a MerchProduct even after it has order history.
-- MerchOrderItem.productId becomes nullable (ON DELETE SET NULL instead of
-- restrict), and a productName snapshot is added so past orders keep
-- showing a real product name after the product row is gone.

-- Snapshot the name for existing rows before making the column NOT NULL.
ALTER TABLE "MerchOrderItem" ADD COLUMN "productName" TEXT;

UPDATE "MerchOrderItem" AS oi
SET "productName" = mp."name"
FROM "MerchProduct" AS mp
WHERE mp."id" = oi."productId";

-- Fallback for any row that somehow has no matching product (shouldn't
-- happen under the old restrict-delete constraint, but be safe).
UPDATE "MerchOrderItem" SET "productName" = 'สินค้า (ไม่ทราบชื่อ)' WHERE "productName" IS NULL;

ALTER TABLE "MerchOrderItem" ALTER COLUMN "productName" SET NOT NULL;

-- Drop the old restrict-on-delete FK and recreate it as nullable + SET NULL.
ALTER TABLE "MerchOrderItem" DROP CONSTRAINT "MerchOrderItem_productId_fkey";
ALTER TABLE "MerchOrderItem" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "MerchOrderItem" ADD CONSTRAINT "MerchOrderItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "MerchProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
