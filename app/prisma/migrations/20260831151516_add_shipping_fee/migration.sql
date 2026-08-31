-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- AlterTable
ALTER TABLE "MerchOrder" ADD COLUMN "shippingFee" DECIMAL(10,2) NOT NULL DEFAULT 50;
