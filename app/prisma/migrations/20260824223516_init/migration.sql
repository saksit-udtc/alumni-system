-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('draft', 'open', 'closed');

-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('full_table', 'seats');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'awaiting_verify', 'confirmed', 'rejected', 'expired');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alumni" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "graduationYear" TEXT,
    "department" TEXT,
    "currentOccupation" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "lineId" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alumni_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "seatsPerTable" INTEGER NOT NULL DEFAULT 10,
    "pricePerTable" DECIMAL(10,2) NOT NULL,
    "pricePerSeat" DECIMAL(10,2) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'draft',
    "floorPlanUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Table" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tableNumber" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "seatsReserved" INTEGER NOT NULL DEFAULT 0,
    "isFullTableBooking" BOOLEAN NOT NULL DEFAULT false,
    "zone" TEXT,
    "zoneColor" TEXT,
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,

    CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "bookingCode" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "bookingType" "BookingType" NOT NULL,
    "seatCount" INTEGER NOT NULL,
    "bookerName" TEXT NOT NULL,
    "bookerPhone" TEXT NOT NULL,
    "bookerEmail" TEXT,
    "partyNames" JSONB,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "reservedUntil" TIMESTAMP(3) NOT NULL,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "checkedInAt" TIMESTAMP(3),
    "checkedInBy" TEXT,
    "souvenirGiven" BOOLEAN NOT NULL DEFAULT false,
    "souvenirGivenAt" TIMESTAMP(3),
    "souvenirGivenBy" TEXT,
    "qrCodeToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSlip" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "PaymentSlip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE INDEX "Alumni_phone_idx" ON "Alumni"("phone");

-- CreateIndex
CREATE INDEX "Table_eventId_idx" ON "Table"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Table_eventId_tableNumber_key" ON "Table"("eventId", "tableNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_bookingCode_key" ON "Reservation"("bookingCode");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_qrCodeToken_key" ON "Reservation"("qrCodeToken");

-- CreateIndex
CREATE INDEX "Reservation_eventId_idx" ON "Reservation"("eventId");

-- CreateIndex
CREATE INDEX "Reservation_tableId_idx" ON "Reservation"("tableId");

-- CreateIndex
CREATE INDEX "Reservation_bookerPhone_idx" ON "Reservation"("bookerPhone");

-- CreateIndex
CREATE INDEX "Reservation_paymentStatus_reservedUntil_idx" ON "Reservation"("paymentStatus", "reservedUntil");

-- CreateIndex
CREATE INDEX "PaymentSlip_reservationId_idx" ON "PaymentSlip"("reservationId");

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_checkedInBy_fkey" FOREIGN KEY ("checkedInBy") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_souvenirGivenBy_fkey" FOREIGN KEY ("souvenirGivenBy") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSlip" ADD CONSTRAINT "PaymentSlip_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSlip" ADD CONSTRAINT "PaymentSlip_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
