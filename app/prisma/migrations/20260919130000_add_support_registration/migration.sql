-- CreateEnum
CREATE TYPE "SupportRegistrationType" AS ENUM ('distinguished_alumni', 'sponsor');

-- CreateTable
CREATE TABLE "SupportRegistration" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "SupportRegistrationType" NOT NULL,
    "name" TEXT NOT NULL,
    "detail" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'awaiting_verify',
    "slipFileKey" TEXT NOT NULL,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportRegistration_code_key" ON "SupportRegistration"("code");

-- CreateIndex
CREATE INDEX "SupportRegistration_type_paymentStatus_idx" ON "SupportRegistration"("type", "paymentStatus");

-- CreateIndex
CREATE INDEX "SupportRegistration_createdAt_idx" ON "SupportRegistration"("createdAt");
