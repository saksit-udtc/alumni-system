import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadObject, PAYMENT_SLIPS_BUCKET } from "@/lib/minio";
import { sendSlipReceivedEmail } from "@/lib/mailer";
import crypto from "crypto";

/**
 * Requirement #9: guest mutating endpoint — verifies ownership via the
 * bookingCode + bookerPhone shared-secret pair (both present in the URL
 * path / multipart form), never trusting a bare reservationId.
 */
export async function POST(req: NextRequest, { params }: { params: { bookingCode: string } }) {
  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "invalid form data" }, { status: 400 });

  const bookerPhone = String(formData.get("bookerPhone") || "");
  const file = formData.get("file") as File | null;

  if (!bookerPhone || !file) {
    return NextResponse.json({ error: "กรุณาระบุเบอร์โทรศัพท์และแนบไฟล์สลิป" }, { status: 400 });
  }

  const reservation = await prisma.reservation.findUnique({
    where: { bookingCode: params.bookingCode.toUpperCase() },
  });

  if (!reservation || reservation.bookerPhone !== bookerPhone) {
    return NextResponse.json({ error: "ไม่พบข้อมูลการจอง หรือเบอร์โทรศัพท์ไม่ถูกต้อง" }, { status: 404 });
  }

  if (!["pending", "awaiting_verify"].includes(reservation.paymentStatus)) {
    return NextResponse.json(
      { error: "ไม่สามารถอัปโหลดสลิปได้ เนื่องจากสถานะการจองไม่รองรับ" },
      { status: 409 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const fileKey = `${reservation.id}/${crypto.randomUUID()}.${ext}`;

  await uploadObject(PAYMENT_SLIPS_BUCKET, fileKey, buffer, file.type || "image/jpeg");

  await prisma.$transaction([
    prisma.paymentSlip.create({
      data: { reservationId: reservation.id, fileKey },
    }),
    prisma.reservation.update({
      where: { id: reservation.id },
      data: { paymentStatus: "awaiting_verify" },
    }),
  ]);

  // Fire-and-forget "slip received, awaiting review" email — never blocks
  // the response, and sendSlipReceivedEmail itself never throws (fail-soft
  // mailer contract, same as the other mailer calls in this app).
  if (reservation.bookerEmail) {
    void (async () => {
      const event = await prisma.event.findUnique({ where: { id: reservation.eventId } });
      if (!event) return;
      await sendSlipReceivedEmail({
        to: reservation.bookerEmail!,
        bookerName: reservation.bookerName,
        eventName: event.name,
        bookingCode: reservation.bookingCode,
      });
    })().catch((err) => console.error("[POST /api/reservations/[bookingCode]/upload-slip] slip-received email failed:", err));
  }

  return NextResponse.json({ ok: true });
}
