import { NextRequest, NextResponse } from "next/server";
import { createMerchOrder, MerchOrderError } from "@/lib/createMerchOrder";
import { sendMerchOrderReceivedEmail } from "@/lib/mailer";
import { uploadObject, deleteObject, PAYMENT_SLIPS_BUCKET } from "@/lib/minio";
import { verifyMerchOrderSlipAsync } from "@/lib/easyslip";
import { PENDING_HOLD_MINUTES } from "@/lib/holdPolicy";
import crypto from "crypto";

// Public: create a merch order. Fully independent of table booking.
//
// The payment slip is now attached in this same request (multipart/form-data)
// instead of a separate upload-slip step — same one-page checkout pattern as
// /api/reservations. The upload-slip endpoint/page still exist as a fallback.
export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "invalid form data" }, { status: 400 });

  const bookerName = String(formData.get("bookerName") || "");
  const bookerPhone = String(formData.get("bookerPhone") || "");
  const bookerEmail = String(formData.get("bookerEmail") || "");
  const shippingAddress = String(formData.get("shippingAddress") || "");
  const itemsRaw = formData.get("items");
  const file = formData.get("file") as File | null;

  let items: any[] = [];
  if (itemsRaw) {
    try {
      const parsed = JSON.parse(String(itemsRaw));
      if (Array.isArray(parsed)) items = parsed;
    } catch {
      // fall through to the empty-items validation below
    }
  }

  if (
    !bookerName ||
    !bookerPhone ||
    !bookerEmail ||
    !shippingAddress ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" }, { status: 400 });
  }

  // Upload before touching the DB — cleaned up below if order creation
  // fails (out of stock, validation error, etc.).
  // สลิปเป็นทางเลือก: ฟอร์ม 2 ขั้นสร้าง "ร่าง" (pending) ก่อนโดยไม่มีสลิป กันโต๊ะ/สินค้าไว้ตาม
  // lib/holdPolicy.ts แล้วลูกค้าไปแนบสลิปที่หน้าชำระเงิน (upload-slip); ถ้าแนบมาด้วย (ฟอร์มเก่าที่ยังเปิดค้าง
  // อยู่) ก็ทำงานแบบเดิมคือสร้างเป็น awaiting_verify ทันที
  let slipFileKey: string | undefined;
  if (file) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    slipFileKey = `${crypto.randomUUID()}.${ext}`;
    await uploadObject(PAYMENT_SLIPS_BUCKET, slipFileKey, buffer, file.type || "image/jpeg");
  }

  try {
    const order = await createMerchOrder({
      bookerName,
      bookerPhone,
      bookerEmail,
      shippingAddress,
      items: items.map((i: any) => ({
        productId: i.productId,
        size: i.size,
        quantity: Number(i.quantity),
      })),
      slipFileKey,
    });

    // Single "order + slip received" email — the later admin-approval
    // confirmation is the only other email now (2 total, down from 3).
    await sendMerchOrderReceivedEmail({
      to: order.bookerEmail,
      bookerName: order.bookerName,
      bookerPhone: order.bookerPhone,
      orderCode: order.orderCode,
      shippingAddress: order.shippingAddress,
      shippingFee: Number(order.shippingFee),
      totalAmount: Number(order.totalAmount),
      awaitingSlip: !slipFileKey,
      holdMinutes: PENDING_HOLD_MINUTES,
      items: order.items.map((it) => ({
        productName: it.productName,
        size: it.size,
        quantity: it.quantity,
      })),
    });

    if (slipFileKey) void verifyMerchOrderSlipAsync(order.id, slipFileKey, Number(order.totalAmount)).catch((err) =>
      console.error("[POST /api/merch/orders] easyslip verify failed:", err)
    );

    return NextResponse.json({
      ok: true,
      orderCode: order.orderCode,
      orderId: order.id,
      totalAmount: order.totalAmount,
    });
  } catch (err) {
    if (slipFileKey) await deleteObject(PAYMENT_SLIPS_BUCKET, slipFileKey).catch((cleanupErr) =>
      console.error("[POST /api/merch/orders] failed to clean up orphaned slip upload:", cleanupErr)
    );

    if (err instanceof MerchOrderError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    console.error("[POST /api/merch/orders]", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการสั่งซื้อ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
