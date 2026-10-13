import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { phoneLookupVariants } from "@/lib/formValidation";
import { loadReservationProofPdf } from "@/lib/mailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public download of the payment-proof PDF. Same trust model as the status
 * lookup: bookingCode + bookerPhone must both match, and only confirmed
 * reservations get a document.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookingCode = searchParams.get("bookingCode")?.trim().toUpperCase();
  const phone = searchParams.get("phone")?.trim();
  if (!bookingCode || !phone) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  const r = await prisma.reservation.findFirst({
    where: { bookingCode, bookerPhone: { in: phoneLookupVariants(phone) } },
    select: { bookingCode: true, paymentStatus: true },
  });
  if (!r) return NextResponse.json({ error: "ไม่พบข้อมูลการจอง" }, { status: 404 });
  if (r.paymentStatus !== "confirmed") {
    return NextResponse.json({ error: "หลักฐานจะออกให้เมื่อการชำระเงินได้รับการยืนยันแล้ว" }, { status: 409 });
  }

  const pdf = await loadReservationProofPdf(r.bookingCode);
  if (!pdf) return NextResponse.json({ error: "สร้างเอกสารไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="payment-proof-${r.bookingCode}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
