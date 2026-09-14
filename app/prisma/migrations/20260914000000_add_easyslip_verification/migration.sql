-- AlterTable
ALTER TABLE "PaymentSlip" ADD COLUMN     "easyslipStatus" TEXT,
ADD COLUMN     "easyslipMessage" TEXT,
ADD COLUMN     "easyslipTransRef" TEXT,
ADD COLUMN     "easyslipCheckedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MerchPaymentSlip" ADD COLUMN     "easyslipStatus" TEXT,
ADD COLUMN     "easyslipMessage" TEXT,
ADD COLUMN     "easyslipTransRef" TEXT,
ADD COLUMN     "easyslipCheckedAt" TIMESTAMP(3);
