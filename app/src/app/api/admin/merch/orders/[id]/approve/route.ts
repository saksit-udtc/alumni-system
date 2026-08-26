import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";

/**
 * Approve slip -> confirmed, records verifiedBy/verifiedAt on the latest
 * MerchPaymentSlip row. No email step for merch orders (unlike
 * reservations). Mirrors admin/reservations/[id]/approve's atomic
 * updateMany race-guard pattern exactly.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req);
  if (response) return response;

  const order = await prisma.merchOrder.findUnique({
    where: { id: params.id },
    include: { slips: { orderBy: { uploadedAt: "desc" }, take: 1 } },
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

  return NextResponse.json({ ok: true });
}
