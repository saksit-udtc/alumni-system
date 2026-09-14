import { NextRequest, NextResponse } from "next/server";
import { bookPackage, PackageBookingError } from "@/lib/bookPackage";
import { prisma } from "@/lib/prisma";
import { sendBookingReceivedEmail } from "@/lib/mailer";
import { uploadObject, deleteObject, PAYMENT_SLIPS_BUCKET } from "@/lib/minio";
import { verifyReservationSlipAsync } from "@/lib/easyslip";
import crypto from "crypto";

// Public: create a package reservation (Phase 2 of the package feature).
// Deliberately a separate endpoint from ../route.ts (plain table booking)
// rather than branching inside it — that route is a live, already-working
// revenue path and this keeps it completely untouched. Mirrors it closely:
// same multipart/form-data shape (slip attached in the same request), same
// mandatory-slip + mandatory-email rules, same fire-and-forget "booking
// received" email. The only real difference is calling bookPackage()
// instead of bookTable() and requiring a packageId.
export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "invalid form data" }, { status: 400 });

  const eventId = String(formData.get("eventId") || "");
  const tableId = String(formData.get("tableId") || "");
  const packageId = String(formData.get("packageId") || "");
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

  if (!eventId || !tableId || !packageId || !bookerName || !bookerPhone || !bookerEmail) {
    return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "กรุณาแนบไฟล์สลิปโอนเงิน" }, { status: 400 });
  }

  // Defense in depth: only full_table packages are ever meant to be
  // purchasable through the public site (seat-level booking is disabled
  // site-wide — see ../route.ts) even though "seats" packages can exist
  // for POS-only use. Checked here up front, before touching MinIO/DB, so
  // a stale or tampered packageId fails fast with a clear message.
  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  if (!pkg || !pkg.active || pkg.eventId !== eventId) {
    return NextResponse.json({ error: "ไม่พบแพ็กเกจที่ระบุ หรือแพ็กเกจนี้ปิดการขายแล้ว" }, { status: 404 });
  }
  if (pkg.bookingType !== "full_table") {
    return NextResponse.json({ error: "แพ็กเกจนี้ไม่รองรับการซื้อผ่านหน้าเว็บ" }, { status: 400 });
  }

  // Same upload-before-DB-write pattern as ../route.ts — cleaned up below
  // on any booking failure so a failed attempt never leaves an orphaned
  // slip object behind.
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const slipFileKey = `${crypto.randomUUID()}.${ext}`;
  await uploadObject(PAYMENT_SLIPS_BUCKET, slipFileKey, buffer, file.type || "image/jpeg");

  try {
    const reservation = await bookPackage({
      packageId,
      tableId,
      bookerName,
      bookerPhone,
      bookerEmail,
      partyNames,
      slipFileKey,
    });

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
      })().catch((err) => console.error("[POST /api/reservations/package] booking-received email failed:", err));
    }

    void verifyReservationSlipAsync(reservation.id, slipFileKey, Number(reservation.totalAmount)).catch((err) =>
      console.error("[POST /api/reservations/package] easyslip verify failed:", err)
    );

    return NextResponse.json({
      ok: true,
      bookingCode: reservation.bookingCode,
      reservationId: reservation.id,
      reservedUntil: reservation.reservedUntil,
      totalAmount: reservation.totalAmount,
    });
  } catch (err) {
    await deleteObject(PAYMENT_SLIPS_BUCKET, slipFileKey).catch((cleanupErr) =>
      console.error("[POST /api/reservations/package] failed to clean up orphaned slip upload:", cleanupErr)
    );

    if (err instanceof PackageBookingError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 409 });
    }
    console.error("[POST /api/reservations/package]", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการจอง กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
