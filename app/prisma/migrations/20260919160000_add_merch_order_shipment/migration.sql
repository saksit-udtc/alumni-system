-- AlterTable
ALTER TABLE "MerchOrder" ADD COLUMN     "carrier" TEXT NOT NULL DEFAULT 'EMS',
ADD COLUMN     "shipmentEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "trackingNumber" TEXT;
