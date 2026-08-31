import { NextRequest, NextResponse } from "next/server";
import { bookTable, BookingError } from "@/lib/bookTable";
import { prisma } from "@/lib/prisma";
import { sendBookingReceivedEmail } from "@/lib/mailer";
import { uploadObject, deleteObject, PAYMENT_SLIPS_BUCKET } from "@/lib/minio";
import crypto from "crypto";

// Public: create a reservation (requirement #1 — atomic booking).
//
// The payment slip is now attached in this same request (multipart/form-data)
// instead of a separate upload-slip step — one page, one submit, so the
// guest goes straight from "received your booking" to "awaiting review"
// without a second redirect. The upload-slip endpoint/page still exist as a
// fallback for anyone who needs to re-attach a slip later.
export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "invalid form data" }, { status: 400 });

  const eventId = String(formData.get("eventId") || "");
  const tableId = String(formData.get("tableId") || "");
  const bookingType = String(formData.get("bookingType") || "");
  const seatCount = Number(formData.get("seatCount"));
  const bookerName = String(formData.get("bookerName") || "");
  const bookerPhone = String(formData.get("bookerPhone") || "");
  const bookerEmailRaw = formData.get("bookerEmail");
  const bookerEmail = bookerEmailRaw ? String(bookerEmailRaw) : undefined;
  const partyNamesRaw = formData.get("partyNames");
  let partyNames: string[] | undefined;
  if (partyNamesRaw) {
    try {
      const parsed = JSON.parse(String(partyNamesRaw));
      if (Array.isArray(parsed)) partyNames = parsed;
    } catch {
      // ignore malformed partyNames — treated as not provided
    }
  }
  const file = formData.get("file") as File | null;

  if (!eventId || !tableId || !bookingType || !seatCount || !bookerName || !bookerPhone || !bookerEmail) {
    return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" }, { status: 400 });
  }

  // Seat-level booking has been disabled — only whole-table bookings are accepted.
  if (bookingType !== "full_table") {
    return NextResponse.json({ error: "ขณะนี้เปิดให้จองเฉพาะแบบเหมาทั้งโต๊ะเท่านั้น" }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: "กรุณาแนบไฟล์สลิปโอนเงิน" }, { status: 400 });
  }

  // Upload the slip before touching the DB — if the booking itself then
  // fails (table taken in the meantime, validation error, etc.) the
  // orphaned object is cleaned up below rather than left dangling forever.
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const slipFileKey = `${crypto.randomUUID()}.${ext}`;
  await uploadObject(PAYMENT_SLIPS_BUCKET, slipFileKey, buffer, file.type || "image/jpeg");

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
      slipFileKey,
    });

    // Fire-and-forget "booking + slip received" email — now that the slip
    // is attached at creation there is only this one email plus the later
    // admin-approval confirmation (2 total, down from 3). Never blocks the
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
    // Booking failed after the slip was already uploaded — clean up the
    // now-orphaned object. Best-effort: a cleanup failure here must never
    // mask the original booking error returned to the guest.
    await deleteObject(PAYMENT_SLIPS_BUCKET, slipFileKey).catch((cleanupErr) =>
      console.error("[POST /api/reservations] failed to clean up orphaned slip upload:", cleanupErr)
    );

    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 409 });
    }
    console.error("[POST /api/reservations]", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการจอง กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
