import { NextRequest, NextResponse } from "next/server";
import { createMerchOrder, MerchOrderError } from "@/lib/createMerchOrder";
import { sendMerchOrderReceivedEmail } from "@/lib/mailer";
import { uploadObject, deleteObject, PAYMENT_SLIPS_BUCKET } from "@/lib/minio";
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

  if (!file) {
    return NextResponse.json({ error: "กรุณาแนบไฟล์สลิปโอนเงิน" }, { status: 400 });
  }

  // Upload before touching the DB — cleaned up below if order creation
  // fails (out of stock, validation error, etc.).
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const slipFileKey = `${crypto.randomUUID()}.${ext}`;
  await uploadObject(PAYMENT_SLIPS_BUCKET, slipFileKey, buffer, file.type || "image/jpeg");

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
      items: order.items.map((it) => ({
        productName: it.productName,
        size: it.size,
        quantity: it.quantity,
      })),
    });

    return NextResponse.json({
      ok: true,
      orderCode: order.orderCode,
      orderId: order.id,
      totalAmount: order.totalAmount,
    });
  } catch (err) {
    await deleteObject(PAYMENT_SLIPS_BUCKET, slipFileKey).catch((cleanupErr) =>
      console.error("[POST /api/merch/orders] failed to clean up orphaned slip upload:", cleanupErr)
    );

    if (err instanceof MerchOrderError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    console.error("[POST /api/merch/orders]", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการสั่งซื้อ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
