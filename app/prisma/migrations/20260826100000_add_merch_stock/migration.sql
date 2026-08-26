-- Merchandise stock tracking, per product and (optionally) per size.

-- CreateTable
CREATE TABLE "MerchProductStock" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "size" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MerchProductStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MerchProductStock_productId_size_key" ON "MerchProductStock"("productId", "size");

-- CreateIndex
CREATE INDEX "MerchProductStock_productId_idx" ON "MerchProductStock"("productId");

-- AddForeignKey
ALTER TABLE "MerchProductStock" ADD CONSTRAINT "MerchProductStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MerchProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
