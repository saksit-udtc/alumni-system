-- AlterTable: PackageItem gains buyerChoosesSize (admin can leave size open
-- for the buyer to pick at purchase time instead of fixing it up front).
ALTER TABLE "PackageItem" ADD COLUMN     "buyerChoosesSize" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Package.bookingType/seatCount become nullable — null means a
-- merch-only package (no table involved), sold only at the POS counter.
ALTER TABLE "Package" ALTER COLUMN "bookingType" DROP NOT NULL,
ALTER COLUMN "seatCount" DROP NOT NULL;

-- AlterTable: PosSale gains an optional packageId, for a merch-only
-- Package sold through the POS counter (see lib/packageMerchSale.ts).
ALTER TABLE "PosSale" ADD COLUMN     "packageId" TEXT;

-- AlterTable: PosSaleItem.barcode becomes nullable — null for a row that
-- came from a bundled Package item (never individually scanned).
ALTER TABLE "PosSaleItem" ALTER COLUMN "barcode" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "PosSale_packageId_idx" ON "PosSale"("packageId");

-- AddForeignKey
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;
