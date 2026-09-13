/*
  Warnings:

  - A unique constraint covering the columns `[barcode]` on the table `MerchProductStock` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PosPaymentMethod" AS ENUM ('cash', 'transfer');

-- AlterTable
ALTER TABLE "MerchProductStock" ADD COLUMN     "barcode" TEXT;

-- CreateTable
CREATE TABLE "PosSale" (
    "id" TEXT NOT NULL,
    "saleCode" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "paymentMethod" "PosPaymentMethod" NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "buyerName" TEXT,
    "buyerPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosSaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "size" TEXT,
    "barcode" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PosSaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PosSale_saleCode_key" ON "PosSale"("saleCode");

-- CreateIndex
CREATE INDEX "PosSale_cashierId_idx" ON "PosSale"("cashierId");

-- CreateIndex
CREATE INDEX "PosSale_createdAt_idx" ON "PosSale"("createdAt");

-- CreateIndex
CREATE INDEX "PosSaleItem_saleId_idx" ON "PosSaleItem"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchProductStock_barcode_key" ON "MerchProductStock"("barcode");

-- AddForeignKey
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSaleItem" ADD CONSTRAINT "PosSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "PosSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSaleItem" ADD CONSTRAINT "PosSaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MerchProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
