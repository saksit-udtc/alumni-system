import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanPhoneForStorage } from "@/lib/formValidation";
import { uploadObject, PAYMENT_SLIPS_BUCKET } from "@/lib/minio";
import { sendMerchSlipReceivedEmail } from "@/lib/mailer";
import { verifyMerchOrderSlipAsync } from "@/lib/easyslip";
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

  if (!order || cleanPhoneForStorage(order.bookerPhone) !== cleanPhoneForStorage(bookerPhone)) {
    return NextResponse.json({ error: "ไม่พบข้อมูลการสั่งซื้อ หรือเบอร์โทรศัพท์ไม่ถูกต้อง" }, { status: 404 });
  }

  // หมดเวลากันสินค้าแล้ว (expired) แต่ลูกค้าโอนแล้วมาแนบสลิปช้า — เก็บสลิปไว้ให้เจ้าหน้าที่
  // ตรวจสอบ/ติดต่อกลับ โดยไม่เปลี่ยนสถานะ (สต็อกถูกคืนไปแล้ว จึงไม่ยืนยันอัตโนมัติ)
  const isLate = order.paymentStatus === "expired";

  if (!isLate && !["pending", "awaiting_verify"].includes(order.paymentStatus)) {
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

  if (isLate) {
    await prisma.merchPaymentSlip.create({ data: { orderId: order.id, fileKey } });
    return NextResponse.json({ ok: true, late: true });
  }

  // updateMany + เงื่อนไขสถานะ: กันชนกับตัวคืนสต็อกอัตโนมัติ (releaseExpired) ที่อาจตั้งเป็น
  // expired ระหว่างที่ลูกค้ากำลังอัปโหลด — ถ้าสถานะเปลี่ยนไปแล้วต้องไม่ยืนยันทับ
  const attached = await prisma.$transaction(async (tx) => {
    const moved = await tx.merchOrder.updateMany({
      where: { id: order.id, paymentStatus: { in: ["pending", "awaiting_verify"] } },
      data: { paymentStatus: "awaiting_verify", reservedUntil: null },
    });
    await tx.merchPaymentSlip.create({ data: { orderId: order.id, fileKey } });
    return moved.count > 0;
  });
  if (!attached) {
    return NextResponse.json({ ok: true, late: true });
  }

  // ตรวจสลิปอัตโนมัติ (EasySlip) — ฟอร์มใหม่แนบสลิปที่ขั้นนี้ ไม่ใช่ตอนสร้างออเดอร์
  void verifyMerchOrderSlipAsync(order.id, fileKey, Number(order.totalAmount)).catch((err) =>
    console.error("[upload-slip] easyslip verify failed:", err)
  );

  await sendMerchSlipReceivedEmail({
    to: order.bookerEmail,
    bookerName: order.bookerName,
    bookerPhone: order.bookerPhone,
    orderCode: order.orderCode,
  });

  return NextResponse.json({ ok: true });
}
