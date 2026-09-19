-- AlterTable
ALTER TABLE "SupportRegistration" ADD COLUMN "easyslipStatus" TEXT,
ADD COLUMN "easyslipMessage" TEXT,
ADD COLUMN "easyslipTransRef" TEXT,
ADD COLUMN "easyslipCheckedAt" TIMESTAMP(3);
