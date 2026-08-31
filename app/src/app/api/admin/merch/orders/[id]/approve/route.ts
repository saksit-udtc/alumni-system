import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { logAdminAction } from "@/lib/auditLog";
import { sendMerchOrderConfirmedEmail } from "@/lib/mailer";

/**
 * Approve slip -> confirmed, records verifiedBy/verifiedAt on the latest
 * MerchPaymentSlip row, and emails the booker a confirmation (order code,
 * items, shipping address) — bookerEmail is required on every merch order.
 * Mirrors admin/reservations/[id]/approve's atomic updateMany race-guard
 * pattern exactly; the email send is fire-and-forget/fail-soft (mailer.ts
 * never throws) so a bad mail config can never block approval.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF", "FINANCE_STAFF", "RESERVATION_STAFF"]);
  if (response) return response;

  const order = await prisma.merchOrder.findUnique({
    where: { id: params.id },
    include: { slips: { orderBy: { uploadedAt: "desc" }, take: 1 }, items: true },
  });
  if (!order) return jsonError("ไม่พบการสั่งซื้อที่ระบุ", 404);

  if (order.paymentStatus !== "awaiting_verify" && order.paymentStatus !== "pending") {
    return jsonError("สถานะการสั่งซื้อไม่สามารถอนุมัติได้", 409);
  }

  const latestSlip = order.slips[0];
  const note = (await req.json().catch(() => null))?.note as string | undefined;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.merchOrder.updateMany({
      where: { id: order.id, paymentStatus: { in: ["awaiting_verify", "pending"] } },
      data: { paymentStatus: "confirmed" },
    });
    if (result.count === 0) return false;

    if (latestSlip) {
      await tx.merchPaymentSlip.update({
        where: { id: latestSlip.id },
        data: { verifiedBy: admin!.adminId, verifiedAt: new Date(), note: note || null },
      });
    }
    return true;
  });

  if (!updated) {
    return jsonError("สถานะการสั่งซื้อไม่สามารถอนุมัติได้ (มีการอนุมัติไปแล้ว)", 409);
  }

  await logAdminAction({
    adminId: admin!.adminId,
    action: "MERCH_ORDER_APPROVE",
    targetType: "MerchOrder",
    targetId: order.id,
    detail: `orderCode=${order.orderCode}`,
  });

  await sendMerchOrderConfirmedEmail({
    to: order.bookerEmail,
    bookerName: order.bookerName,
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

  return NextResponse.json({ ok: true });
}
