import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Public status lookup. Requirement #9: requires bookingCode + bookerPhone
 * pair (or, for a phone-only search, only returns non-sensitive summary
 * fields — no reservationId-only trust anywhere).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookingCode = searchParams.get("bookingCode")?.trim().toUpperCase();
  const phone = searchParams.get("phone")?.trim();

  if (!phone) {
    return NextResponse.json({ error: "กรุณาระบุเบอร์โทรศัพท์" }, { status: 400 });
  }

  const where = bookingCode
    ? { bookingCode, bookerPhone: phone }
    : { bookerPhone: phone };

  const reservations = await prisma.reservation.findMany({
    where,
    include: {
      event: { select: { name: true, eventDate: true } },
      table: { select: { tableNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (bookingCode && reservations.length === 0) {
    return NextResponse.json({ error: "ไม่พบข้อมูลการจอง" }, { status: 404 });
  }

  return NextResponse.json({
    reservations: reservations.map((r) => ({
      bookingCode: r.bookingCode,
      eventName: r.event.name,
      eventDate: r.event.eventDate,
      tableNumber: r.table.tableNumber,
      bookingType: r.bookingType,
      seatCount: r.seatCount,
      totalAmount: r.totalAmount,
      paymentStatus: r.paymentStatus,
      reservedUntil: r.reservedUntil,
      qrCodeToken: r.paymentStatus === "confirmed" ? r.qrCodeToken : null,
      checkedIn: r.checkedIn,
    })),
  });
}
