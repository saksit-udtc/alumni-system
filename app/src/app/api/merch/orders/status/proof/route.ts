import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { phoneLookupVariants } from "@/lib/formValidation";
import { loadMerchProofPdf } from "@/lib/mailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public download of the merch payment-proof PDF. orderCode + bookerPhone
 * must both match, and only confirmed orders get a document.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderCode = searchParams.get("orderCode")?.trim().toUpperCase();
  const phone = searchParams.get("phone")?.trim();
  if (!orderCode || !phone) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  const o = await prisma.merchOrder.findFirst({
    where: { orderCode, bookerPhone: { in: phoneLookupVariants(phone) } },
    select: { orderCode: true, paymentStatus: true },
  });
  if (!o) return NextResponse.json({ error: "ไม่พบข้อมูลการสั่งซื้อ" }, { status: 404 });
  if (o.paymentStatus !== "confirmed") {
    return NextResponse.json({ error: "หลักฐานจะออกให้เมื่อการชำระเงินได้รับการยืนยันแล้ว" }, { status: 409 });
  }

  const pdf = await loadMerchProofPdf(o.orderCode);
  if (!pdf) return NextResponse.json({ error: "สร้างเอกสารไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="payment-proof-${o.orderCode}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
