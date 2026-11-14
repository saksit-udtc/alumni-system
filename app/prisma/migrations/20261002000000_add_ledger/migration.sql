-- สมุดบัญชีรายวัน: เพิ่มตารางใหม่ 2 ตาราง + enum 2 ตัว เท่านั้น
-- ไม่แก้/ลบ/ผูก FK กับตารางเดิมใดๆ (additive — ย้อนกลับได้ด้วย DROP TABLE/TYPE ด้านล่าง)
--   DROP TABLE "DailyClosing"; DROP TABLE "LedgerEntry";
--   DROP TYPE "LedgerMethod"; DROP TYPE "LedgerEntryType";

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('income', 'expense');

-- CreateEnum
CREATE TYPE "LedgerMethod" AS ENUM ('cash', 'transfer');

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "method" "LedgerMethod" NOT NULL DEFAULT 'cash',
    "category" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "receiptNo" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedByName" TEXT,
    "voidReason" TEXT,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyClosing" (
    "id" TEXT NOT NULL,
    "closingDate" DATE NOT NULL,
    "autoIncome" DECIMAL(12,2) NOT NULL,
    "manualIncome" DECIMAL(12,2) NOT NULL,
    "expense" DECIMAL(12,2) NOT NULL,
    "net" DECIMAL(12,2) NOT NULL,
    "expectedCash" DECIMAL(12,2) NOT NULL,
    "countedCash" DECIMAL(12,2),
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "closedById" TEXT,
    "closedByName" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyClosing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LedgerEntry_entryDate_idx" ON "LedgerEntry"("entryDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyClosing_closingDate_key" ON "DailyClosing"("closingDate");
