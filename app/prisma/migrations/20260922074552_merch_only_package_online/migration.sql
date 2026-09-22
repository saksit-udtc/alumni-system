-- AlterTable: MerchOrder gains an optional packageId — a merch-only
-- Package (bookingType null) is now sold online through the merch shop
-- (see lib/createMerchPackageOrder.ts), not through the POS counter.
ALTER TABLE "MerchOrder" ADD COLUMN     "packageId" TEXT;

-- CreateIndex
CREATE INDEX "MerchOrder_packageId_idx" ON "MerchOrder"("packageId");

-- AddForeignKey
ALTER TABLE "MerchOrder" ADD CONSTRAINT "MerchOrder_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;
