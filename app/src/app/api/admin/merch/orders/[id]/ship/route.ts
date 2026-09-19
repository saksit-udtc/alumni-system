import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { logAdminAction } from "@/lib/auditLog";
import { sendMerchOrderShippedEmail } from "@/lib/mailer";
import { normalizeTrackingNumber, isValidEmsNumber } from "@/lib/shipping";

/**
 * Record (or correct) the EMS tracking number for a confirmed merch order and
 * email the booker that the parcel has shipped.
 *
 * Body:
 *  - { trackingNumber: "EE123456789TH" }  -> save number, then email
 *  - { resendEmail: true }                -> re-send the email for the number already saved
 *
 * The number is saved BEFORE the email is attempted, and a mail failure never
 * fails the request (mailer.ts is fail-soft) — the response just reports
 * emailSent:false so the admin UI can offer a resend button.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF", "FINANCE_STAFF", "RESERVATION_STAFF"]);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const resendOnly = body?.resendEmail === true;
  const rawTracking = typeof body?.trackingNumber === "string" ? body.trackingNumber : "";

  const order = await prisma.merchOrder.findUnique({
    where: { id: params.id },
    include: { items: true },
  });
  if (!order) return jsonError("ไม่พบการสั่งซื้อที่ระบุ", 404);

  if (order.paymentStatus !== "confirmed") {
    return jsonError("ส่งได้เฉพาะคำสั่งซื้อที่ยืนยันการชำระเงินแล้วเท่านั้น", 409);
  }

  let trackingNumber = order.trackingNumber;
  let shippedAt = order.shippedAt;

  if (resendOnly) {
    if (!trackingNumber || !shippedAt) return jsonError("ยังไม่ได้บันทึกเลขพัสดุสำหรับคำสั่งซื้อนี้", 400);
  } else {
    const normalized = normalizeTrackingNumber(rawTracking);
    if (!normalized) return jsonError("กรุณาระบุเลขพัสดุ EMS", 400);
    if (!isValidEmsNumber(normalized)) {
      return jsonError("รูปแบบเลข EMS ไม่ถูกต้อง (ต้องเป็นตัวอักษร 2 ตัว + ตัวเลข 9 ตัว + TH เช่น EE123456789TH)", 400);
    }

    const changed = normalized !== order.trackingNumber;
    trackingNumber = normalized;
    shippedAt = order.shippedAt ?? new Date(); // first ship date is kept when the number is later corrected

    await prisma.merchOrder.update({
      where: { id: order.id },
      data: {
        trackingNumber,
        shippedAt,
        // A corrected number must be re-announced; the same number keeps its send state.
        ...(changed ? { shipmentEmailSentAt: null } : {}),
      },
    });
  }

  await logAdminAction({
    adminId: admin!.adminId,
    action: resendOnly ? "MERCH_ORDER_SHIPPED_RESEND_EMAIL" : "MERCH_ORDER_SET_TRACKING",
    targetType: "MerchOrder",
    targetId: order.id,
    detail: `orderCode=${order.orderCode} tracking=${trackingNumber}`,
  });

  const emailSent = await sendMerchOrderShippedEmail({
    to: order.bookerEmail,
    bookerName: order.bookerName,
    bookerPhone: order.bookerPhone,
    orderCode: order.orderCode,
    shippingAddress: order.shippingAddress,
    carrier: order.carrier,
    trackingNumber: trackingNumber!,
    shippedAt: shippedAt!,
    items: order.items.map((it) => ({
      productName: it.productName,
      size: it.size,
      quantity: it.quantity,
    })),
  });

  let shipmentEmailSentAt = emailSent ? new Date() : null;
  if (emailSent) {
    await prisma.merchOrder.update({
      where: { id: order.id },
      data: { shipmentEmailSentAt },
    });
  } else if (resendOnly) {
    shipmentEmailSentAt = order.shipmentEmailSentAt;
  }

  return NextResponse.json({
    ok: true,
    emailSent,
    trackingNumber,
    shippedAt,
    shipmentEmailSentAt,
  });
}
