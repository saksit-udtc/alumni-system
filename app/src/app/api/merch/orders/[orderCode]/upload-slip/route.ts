import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadObject, PAYMENT_SLIPS_BUCKET } from "@/lib/minio";
import { sendMerchSlipReceivedEmail } from "@/lib/mailer";
import crypto from "crypto";

/**
 * Guest mutating endpoint — verifies ownership via the orderCode +
 * bookerPhone shared-secret pair, never trusting a bare orderId. Mirrors
 * reservations/[bookingCode]/upload-slip, including the "slip received"
 * email step.
 */
export async function POST(req: NextRequest, { params }: { params: { orderCode: string } }) {
  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "invalid form data" }, { status: 400 });

  const bookerPhone = String(formData.get("bookerPhone") || "");
  const file = formData.get("file") as File | null;

  if (!bookerPhone || !file) {
    return NextResponse.json({ error: "กรุณาระบุเบอร์โทรศัพท์และแนบไฟล์สลิป" }, { status: 400 });
  }

  const order = await prisma.merchOrder.findUnique({
    where: { orderCode: params.orderCode.toUpperCase() },
  });

  if (!order || order.bookerPhone !== bookerPhone) {
    return NextResponse.json({ error: "ไม่พบข้อมูลการสั่งซื้อ หรือเบอร์โทรศัพท์ไม่ถูกต้อง" }, { status: 404 });
  }

  if (!["pending", "awaiting_verify"].includes(order.paymentStatus)) {
    return NextResponse.json(
      { error: "ไม่สามารถอัปโหลดสลิปได้ เนื่องจากสถานะการสั่งซื้อไม่รองรับ" },
      { status: 409 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const fileKey = `${order.id}/${crypto.randomUUID()}.${ext}`;

  await uploadObject(PAYMENT_SLIPS_BUCKET, fileKey, buffer, file.type || "image/jpeg");

  await prisma.$transaction([
    prisma.merchPaymentSlip.create({
      data: { orderId: order.id, fileKey },
    }),
    prisma.merchOrder.update({
      where: { id: order.id },
      data: { paymentStatus: "awaiting_verify" },
    }),
  ]);

  await sendMerchSlipReceivedEmail({
    to: order.bookerEmail,
    bookerName: order.bookerName,
    bookerPhone: order.bookerPhone,
    orderCode: order.orderCode,
  });

  return NextResponse.json({ ok: true });
}
