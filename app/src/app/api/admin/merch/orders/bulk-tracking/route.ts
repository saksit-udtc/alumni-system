import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { logAdminAction } from "@/lib/auditLog";
import { sendMerchOrderShippedEmail } from "@/lib/mailer";
import { MERCH_PICKUP_ADDRESS_TEXT } from "@/lib/settings";
import { normalizeTrackingNumber, validateTrackingNumber, isKnownCarrier } from "@/lib/shipping";

/**
 * บันทึกเลขพัสดุหลายออเดอร์ในครั้งเดียว (ใช้ตอนส่งมอบให้พนักงานขนส่งแล้วได้เลขมา)
 * Body: { carrier: "FLASH" | "EMS", entries: [{ orderCode, trackingNumber }] }  (ไม่เกิน 20 รายการต่อคำขอ)
 *
 * ทำทีละรายการ ผลลัพธ์รายการที่ผิดไม่ทำให้รายการอื่นล้ม; ส่งอีเมลแจ้งลูกค้าต่อรายการ
 * (fail-soft เหมือนหน้าเดี่ยว — อีเมลส่งไม่ออกก็ยังบันทึกเลขไว้ แล้วไปกด "ส่งอีเมลอีกครั้ง" ได้)
 * ออเดอร์ที่มีเลขพัสดุอยู่แล้วจะไม่ถูกทับ ให้ไปแก้ที่หน้าคำสั่งซื้อ
 */
export async function POST(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF", "RESERVATION_STAFF"]);
  if (response) return response;

  const body = await req.json().catch(() => null);
  if (!isKnownCarrier(body?.carrier)) return jsonError("กรุณาเลือกขนส่ง", 400);
  const carrier = body.carrier;
  const entries: { orderCode?: unknown; trackingNumber?: unknown }[] = Array.isArray(body?.entries)
    ? body.entries
    : [];
  if (entries.length === 0) return jsonError("ไม่มีรายการ", 400);
  if (entries.length > 20) return jsonError("ส่งได้ครั้งละไม่เกิน 20 รายการ", 400);

  type Result = { orderCode: string; ok: boolean; error?: string; emailSent?: boolean; trackingNumber?: string };
  const results: Result[] = [];
  const usedInBatch = new Set<string>();

  for (const e of entries) {
    const orderCode = typeof e.orderCode === "string" ? e.orderCode.trim() : "";
    const tracking = normalizeTrackingNumber(typeof e.trackingNumber === "string" ? e.trackingNumber : "");
    const fail = (error: string) => results.push({ orderCode, ok: false, error });

    if (!orderCode) { fail("ไม่มีรหัสคำสั่งซื้อ"); continue; }
    const formatError = validateTrackingNumber(carrier, tracking);
    if (formatError) { fail(formatError); continue; }
    if (usedInBatch.has(tracking)) { fail("เลขพัสดุซ้ำกับรายการอื่นในชุดนี้"); continue; }

    const order = await prisma.merchOrder.findFirst({
      where: { orderCode: { equals: orderCode, mode: "insensitive" } },
      include: { items: true },
    });
    if (!order) { fail("ไม่พบคำสั่งซื้อ"); continue; }
    if (order.paymentStatus !== "confirmed") { fail("ยังไม่ยืนยันการชำระเงิน"); continue; }
    if (order.shippingAddress === MERCH_PICKUP_ADDRESS_TEXT) { fail("เป็นออเดอร์รับที่วิทยาลัย ไม่ต้องจัดส่ง"); continue; }
    if (order.trackingNumber) {
      fail(`มีเลขพัสดุอยู่แล้ว (${order.trackingNumber}) — แก้ที่หน้าคำสั่งซื้อ`);
      continue;
    }

    const dup = await prisma.merchOrder.findFirst({
      where: { trackingNumber: tracking },
      select: { orderCode: true },
    });
    if (dup) { fail(`เลขพัสดุนี้ถูกใช้กับคำสั่งซื้อ ${dup.orderCode} แล้ว`); continue; }

    const shippedAt = new Date();
    await prisma.merchOrder.update({
      where: { id: order.id },
      data: {
        trackingNumber: tracking,
        carrier,
        shippedAt,
        shipmentEmailSentAt: null,
        ...(order.packedAt ? {} : { packedAt: shippedAt }),
      },
    });
    usedInBatch.add(tracking);

    await logAdminAction({
      adminId: admin!.adminId,
      action: "MERCH_ORDER_SET_TRACKING",
      targetType: "MerchOrder",
      targetId: order.id,
      detail: `orderCode=${order.orderCode} carrier=${carrier} tracking=${tracking} (bulk)`,
    });

    const emailSent = await sendMerchOrderShippedEmail({
      to: order.bookerEmail,
      bookerName: order.bookerName,
      bookerPhone: order.bookerPhone,
      orderCode: order.orderCode,
      shippingAddress: order.shippingAddress,
      carrier,
      trackingNumber: tracking,
      shippedAt,
      items: order.items.map((it) => ({ productName: it.productName, size: it.size, quantity: it.quantity })),
    });
    if (emailSent) {
      await prisma.merchOrder.update({ where: { id: order.id }, data: { shipmentEmailSentAt: new Date() } });
    }
    results.push({ orderCode: order.orderCode, ok: true, emailSent, trackingNumber: tracking });
  }

  return NextResponse.json({ results });
}
