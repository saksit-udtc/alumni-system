-- CreateEnum
CREATE TYPE "MerchWithdrawalStatus" AS ENUM ('active', 'cancelled');

-- CreateTable
CREATE TABLE "MerchWithdrawal" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requesterPosition" TEXT,
    "purpose" TEXT NOT NULL,
    "approverName" TEXT NOT NULL,
    "note" TEXT,
    "status" "MerchWithdrawalStatus" NOT NULL DEFAULT 'active',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,

    CONSTRAINT "MerchWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchWithdrawalItem" (
    "id" TEXT NOT NULL,
    "withdrawalId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "size" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "MerchWithdrawalItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MerchWithdrawal_code_key" ON "MerchWithdrawal"("code");
CREATE INDEX "MerchWithdrawal_createdAt_idx" ON "MerchWithdrawal"("createdAt");
CREATE INDEX "MerchWithdrawalItem_withdrawalId_idx" ON "MerchWithdrawalItem"("withdrawalId");

-- AddForeignKey
ALTER TABLE "MerchWithdrawal" ADD CONSTRAINT "MerchWithdrawal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchWithdrawalItem" ADD CONSTRAINT "MerchWithdrawalItem_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "MerchWithdrawal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
