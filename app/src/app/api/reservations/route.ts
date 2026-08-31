import { NextRequest, NextResponse } from "next/server";
import { bookTable, BookingError } from "@/lib/bookTable";
import { prisma } from "@/lib/prisma";
import { sendBookingReceivedEmail } from "@/lib/mailer";

// Public: create a reservation (requirement #1 — atomic booking).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const { eventId, tableId, bookingType, seatCount, bookerName, bookerPhone, bookerEmail, partyNames } = body;

  if (!eventId || !tableId || !bookingType || !seatCount || !bookerName || !bookerPhone) {
    return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" }, { status: 400 });
  }

  // Seat-level booking has been disabled — only whole-table bookings are accepted.
  if (bookingType !== "full_table") {
    return NextResponse.json({ error: "ขณะนี้เปิดให้จองเฉพาะแบบเหมาทั้งโต๊ะเท่านั้น" }, { status: 400 });
  }

  try {
    const reservation = await bookTable({
      eventId,
      tableId,
      bookingType,
      seatCount: Number(seatCount),
      bookerName,
      bookerPhone,
      bookerEmail,
      partyNames,
    });

    // Fire-and-forget "booking received" email — no QR yet, just confirms
    // the hold and reminds the guest to upload a slip. Never blocks the
    // response, and sendBookingReceivedEmail itself never throws (fail-soft
    // mailer contract). bookTable() returns the bare Reservation row, so the
    // event name / table number for the email are fetched separately here.
    if (reservation.bookerEmail) {
      void (async () => {
        const [event, table] = await Promise.all([
          prisma.event.findUnique({ where: { id: reservation.eventId } }),
          prisma.table.findUnique({ where: { id: reservation.tableId } }),
        ]);
        if (!event) return;
        await sendBookingReceivedEmail({
          to: reservation.bookerEmail!,
          bookerName: reservation.bookerName,
          bookerPhone: reservation.bookerPhone,
          eventName: event.name,
          tableNumber: table?.tableNumber ?? null,
          zone: table?.zone ?? null,
          bookingType: reservation.bookingType,
          seatCount: reservation.seatCount,
          totalAmount: Number(reservation.totalAmount),
          bookingCode: reservation.bookingCode,
        });
      })().catch((err) => console.error("[POST /api/reservations] booking-received email failed:", err));
    }

    return NextResponse.json({
      ok: true,
      bookingCode: reservation.bookingCode,
      reservationId: reservation.id,
      reservedUntil: reservation.reservedUntil,
      totalAmount: reservation.totalAmount,
    });
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 409 });
    }
    console.error("[POST /api/reservations]", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการจอง กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
