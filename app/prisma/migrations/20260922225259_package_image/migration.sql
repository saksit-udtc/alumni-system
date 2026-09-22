-- AlterTable: Package gains an optional cover image, shown on the merch
-- shop's package card and the package's own purchase page (same
-- convention as MerchProduct.imageKey).
ALTER TABLE "Package" ADD COLUMN     "imageKey" TEXT;
