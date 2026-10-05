import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { logAdminAction } from "@/lib/auditLog";
import { normalizeEmail } from "@/lib/formValidation";
import {
  sendConfirmationEmail,
  sendBookingReceivedEmail,
  sendSlipReceivedEmail,
  sendMerchOrderReceivedEmail,
  sendMerchOrderConfirmedEmail,
  sendMerchSlipReceivedEmail,
} from "@/lib/mailer";

/**
 * Resend a FAILED email from the email-log page, optionally correcting the
 * booker's email first (wrong address typed by the guest).
 *
 * Body: { email?: string }
 *  - email omitted  -> resend to the address currently on the order/booking
 *  - email given    -> validate, save it on the order/booking, then send there
 *
 * SUPER_ADMIN only (same as the email-log page itself). The email is sent
 * through the normal mailer functions, so the result is logged as a new
 * EmailLog row (SUCCESS or FAILED). The route reports sent:true/false by
 * checking that new row, since mailer functions are fail-soft (never throw).
 */

const MERCH_TYPES = ["MERCH_ORDER_RECEIVED", "MERCH_ORDER_CONFIRMED", "MERCH_SLIP_RECEIVED"];
const RESERVATION_TYPES = ["BOOKING_RECEIVED", "SLIP_RECEIVED", "CONFIRMATION"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const newEmailRaw = typeof body?.email === "string" ? body.email.trim() : "";
  const newEmail = newEmailRaw ? normalizeEmail(newEmailRaw) : "";
  if (newEmailRaw && !EMAIL_RE.test(newEmail)) return jsonError("รูปแบบอีเมลไม่ถูกต้อง", 400);

  const log = await prisma.emailLog.findUnique({ where: { id: params.id } });
  if (!log) return jsonError("ไม่พบรายการ log นี้", 404);

  const isMerch = MERCH_TYPES.includes(log.type);
  const isReservation = RESERVATION_TYPES.includes(log.type);
  if (!isMerch && !isReservation) {
    return jsonError("อีเมลประเภทนี้ยังไม่รองรับการส่งซ้ำจากหน้านี้", 400);
  }

  const startedAt = new Date();
  let sent = false;
  let recipient = "";

  if (isMerch) {
    // Rows logged before the `ref` column existed fall back to the newest
    // order whose email matches the recipient.
    const order = await prisma.merchOrder.findFirst({
      where: log.ref
        ? { orderCode: log.ref }
        : { bookerEmail: { equals: log.recipient, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });
    if (!order) return jsonError("ไม่พบคำสั่งซื้อที่เกี่ยวข้องกับอีเมลนี้", 404);
    if (log.type === "MERCH_ORDER_CONFIRMED" && order.paymentStatus !== "confirmed") {
      return jsonError("คำสั่งซื้อนี้ยังไม่ได้ยืนยันการชำระเงิน จึงส่งอีเมลยืนยันไม่ได้", 409);
    }

    if (newEmail && newEmail !== order.bookerEmail) {
      await prisma.merchOrder.update({ where: { id: order.id }, data: { bookerEmail: newEmail } });
    }
    recipient = newEmail || order.bookerEmail;

    if (log.type === "MERCH_ORDER_RECEIVED") {
      await sendMerchOrderReceivedEmail({
        to: recipient,
        bookerName: order.bookerName,
        bookerPhone: order.bookerPhone,
        orderCode: order.orderCode,
        shippingAddress: order.shippingAddress,
        shippingFee: Number(order.shippingFee),
        totalAmount: Number(order.totalAmount),
        items: order.items.map((it) => ({ productName: it.productName, size: it.size, quantity: it.quantity })),
      });
    } else if (log.type === "MERCH_ORDER_CONFIRMED") {
      await sendMerchOrderConfirmedEmail({
        to: recipient,
        bookerName: order.bookerName,
        orderCode: order.orderCode,
        shippingAddress: order.shippingAddress,
        shippingFee: Number(order.shippingFee),
        totalAmount: Number(order.totalAmount),
        items: order.items.map((it) => ({ productName: it.productName, size: it.size, quantity: it.quantity })),
      });
    } else {
      await sendMerchSlipReceivedEmail({
        to: recipient,
        bookerName: order.bookerName,
        bookerPhone: order.bookerPhone,
        orderCode: order.orderCode,
      });
    }

    await logAdminAction({
      adminId: admin!.adminId,
      action: "EMAIL_RESEND",
      targetType: "MerchOrder",
      targetId: order.id,
      detail: `orderCode=${order.orderCode} type=${log.type}${newEmail && newEmail !== order.bookerEmail ? ` email ${order.bookerEmail} -> ${newEmail}` : ""}`,
    });
  } else {
    const reservation = await prisma.reservation.findFirst({
      where: log.ref
        ? { bookingCode: log.ref }
        : { bookerEmail: { equals: log.recipient, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      include: { event: true, table: true },
    });
    if (!reservation) return jsonError("ไม่พบการจองที่เกี่ยวข้องกับอีเมลนี้", 404);
    if (log.type === "CONFIRMATION" && (reservation.paymentStatus !== "confirmed" || !reservation.qrCodeToken)) {
      return jsonError("การจองนี้ยังไม่ได้ยืนยันการชำระเงิน จึงส่งอีเมลยืนยัน (QR) ไม่ได้", 409);
    }

    if (newEmail && newEmail !== reservation.bookerEmail) {
      await prisma.reservation.update({ where: { id: reservation.id }, data: { bookerEmail: newEmail } });
    }
    recipient = newEmail || reservation.bookerEmail || "";
    if (!recipient) return jsonError("การจองนี้ไม่มีอีเมล กรุณาระบุอีเมลใหม่", 400);

    if (log.type === "BOOKING_RECEIVED") {
      await sendBookingReceivedEmail({
        to: recipient,
        bookerName: reservation.bookerName,
        bookerPhone: reservation.bookerPhone,
        eventName: reservation.event.name,
        tableNumber: reservation.table?.tableNumber ?? null,
        zone: reservation.table?.zone ?? null,
        bookingType: reservation.bookingType,
        seatCount: reservation.seatCount,
        totalAmount: Number(reservation.totalAmount),
        bookingCode: reservation.bookingCode,
      });
    } else if (log.type === "SLIP_RECEIVED") {
      await sendSlipReceivedEmail({
        to: recipient,
        bookerName: reservation.bookerName,
        bookerPhone: reservation.bookerPhone,
        eventName: reservation.event.name,
        bookingCode: reservation.bookingCode,
      });
    } else {
      await sendConfirmationEmail({
        to: recipient,
        bookerName: reservation.bookerName,
        eventName: reservation.event.name,
        tableNumber: reservation.table!.tableNumber,
        bookingCode: reservation.bookingCode,
        qrCodeToken: reservation.qrCodeToken!,
      });
    }

    await logAdminAction({
      adminId: admin!.adminId,
      action: "EMAIL_RESEND",
      targetType: "Reservation",
      targetId: reservation.id,
      detail: `bookingCode=${reservation.bookingCode} type=${log.type}${newEmail && newEmail !== reservation.bookerEmail ? ` email ${reservation.bookerEmail} -> ${newEmail}` : ""}`,
    });
  }

  // mailer is fail-soft: the outcome is whatever it just wrote to EmailLog.
  const result = await prisma.emailLog.findFirst({
    where: { type: log.type, recipient, createdAt: { gte: startedAt } },
    orderBy: { createdAt: "desc" },
  });
  sent = result?.status === "SUCCESS";

  return NextResponse.json({ ok: true, sent, recipient, error: sent ? null : result?.error ?? "ไม่ได้ตั้งค่าอีเมลของระบบ" });
}
