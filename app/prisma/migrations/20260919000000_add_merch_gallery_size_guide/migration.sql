-- Merch product detail view: extra gallery photos + optional size-chart image.

-- AlterTable
ALTER TABLE "MerchProduct" ADD COLUMN "sizeGuideKey" TEXT;

-- CreateTable
CREATE TABLE "MerchProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MerchProductImage_productId_sortOrder_idx" ON "MerchProductImage"("productId", "sortOrder");

-- AddForeignKey
ALTER TABLE "MerchProductImage" ADD CONSTRAINT "MerchProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MerchProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
