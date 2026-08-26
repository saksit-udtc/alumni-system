-- Merchandise ordering (สั่งซื้อของที่ระลึก)
-- Fully independent of table booking. Reuses the existing "PaymentStatus"
-- enum (already created by an earlier migration for Reservation/PaymentSlip).

-- CreateTable
CREATE TABLE "MerchProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "imageKey" TEXT,
    "requiresSize" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchOrder" (
    "id" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "bookerName" TEXT NOT NULL,
    "bookerPhone" TEXT NOT NULL,
    "bookerEmail" TEXT,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "size" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "MerchOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchPaymentSlip" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "MerchPaymentSlip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MerchOrder_orderCode_key" ON "MerchOrder"("orderCode");

-- CreateIndex
CREATE INDEX "MerchOrder_bookerPhone_idx" ON "MerchOrder"("bookerPhone");

-- CreateIndex
CREATE INDEX "MerchOrder_paymentStatus_idx" ON "MerchOrder"("paymentStatus");

-- CreateIndex
CREATE INDEX "MerchOrderItem_orderId_idx" ON "MerchOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "MerchPaymentSlip_orderId_idx" ON "MerchPaymentSlip"("orderId");

-- AddForeignKey
ALTER TABLE "MerchOrderItem" ADD CONSTRAINT "MerchOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MerchOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchOrderItem" ADD CONSTRAINT "MerchOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MerchProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchPaymentSlip" ADD CONSTRAINT "MerchPaymentSlip_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MerchOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchPaymentSlip" ADD CONSTRAINT "MerchPaymentSlip_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
