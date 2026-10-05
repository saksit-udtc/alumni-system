import { NextRequest, NextResponse } from "next/server";
import { createMerchPackageOrder, MerchPackageOrderError } from "@/lib/createMerchPackageOrder";
import { sendMerchOrderReceivedEmail } from "@/lib/mailer";
import { uploadObject, deleteObject, PAYMENT_SLIPS_BUCKET } from "@/lib/minio";
import { verifyMerchOrderSlipAsync } from "@/lib/easyslip";
import { PENDING_HOLD_MINUTES } from "@/lib/holdPolicy";
import crypto from "crypto";

// Public: order a merch-only Package (bookingType null — "เฉพาะของที่ระลึก",
// no table at all), sold online only. A sibling of ../route.ts (plain
// product-cart order) — that route is never touched — mirroring its same
// multipart/form-data shape (slip attached in the same request), same
// mandatory-slip + mandatory-shipping-address + mandatory-email rules, same
// fire-and-forget "order received" email. The only real difference is
// calling createMerchPackageOrder() instead of createMerchOrder() and
// requiring a packageId instead of a product cart.
export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "invalid form data" }, { status: 400 });

  const packageId = String(formData.get("packageId") || "");
  const bookerName = String(formData.get("bookerName") || "");
  const bookerPhone = String(formData.get("bookerPhone") || "");
  const bookerEmail = String(formData.get("bookerEmail") || "");
  const shippingAddress = String(formData.get("shippingAddress") || "");
  const file = formData.get("file") as File | null;
  const itemSizeSelectionsRaw = formData.get("itemSizeSelections");
  let itemSizeSelections: Record<string, string> | undefined;
  if (itemSizeSelectionsRaw) {
    try {
      const parsed = JSON.parse(String(itemSizeSelectionsRaw));
      if (parsed && typeof parsed === "object") itemSizeSelections = parsed;
    } catch {
      // ignore malformed input — createMerchPackageOrder() will reject
      // with SIZE_REQUIRED if the package actually needs it
    }
  }

  if (!packageId || !bookerName || !bookerPhone || !bookerEmail || !shippingAddress) {
    return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" }, { status: 400 });
  }
  // Same upload-before-DB-write pattern as ../route.ts — cleaned up below
  // on any order-creation failure so a failed attempt never leaves an
  // orphaned slip object behind.
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
    const order = await createMerchPackageOrder({
      packageId,
      bookerName,
      bookerPhone,
      bookerEmail,
      shippingAddress,
      itemSizeSelections,
      slipFileKey,
    });

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
      console.error("[POST /api/merch/orders/package] easyslip verify failed:", err)
    );

    return NextResponse.json({
      ok: true,
      orderCode: order.orderCode,
      orderId: order.id,
      totalAmount: order.totalAmount,
    });
  } catch (err) {
    if (slipFileKey) await deleteObject(PAYMENT_SLIPS_BUCKET, slipFileKey).catch((cleanupErr) =>
      console.error("[POST /api/merch/orders/package] failed to clean up orphaned slip upload:", cleanupErr)
    );

    if (err instanceof MerchPackageOrderError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    console.error("[POST /api/merch/orders/package]", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการสั่งซื้อ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
