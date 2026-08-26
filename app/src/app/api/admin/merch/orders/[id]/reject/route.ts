import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";

/**
 * Admin "reject slip" for a merch order. Merch orders have no seat/table to
 * release, so — unlike the reservation reject route — this is a plain
 * atomic updateMany race-guard transition instead of going through
 * releaseReservation.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req);
  if (response) return response;

  const order = await prisma.merchOrder.findUnique({
    where: { id: params.id },
    include: {
      slips: { orderBy: { uploadedAt: "desc" }, take: 1 },
      items: true,
    },
  });
  if (!order) return jsonError("ไม่พบการสั่งซื้อที่ระบุ", 404);

  if (order.paymentStatus !== "awaiting_verify" && order.paymentStatus !== "pending") {
    return jsonError("สถานะการสั่งซื้อไม่สามารถปฏิเสธได้", 409);
  }

  const body = await req.json().catch(() => ({}));
  const note = body?.note as string | undefined;
  const latestSlip = order.slips[0];

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.merchOrder.updateMany({
      where: { id: order.id, paymentStatus: { in: ["awaiting_verify", "pending"] } },
      data: { paymentStatus: "rejected" },
    });
    if (result.count === 0) return false;

    // Rejecting means the order won't be fulfilled — give the stock back so
    // the product/size becomes purchasable again. Uses upsert (not a plain
    // increment) because a size row could in theory have been removed by
    // the admin after the order was placed.
    for (const item of order.items) {
      await tx.merchProductStock.upsert({
        where: { productId_size: { productId: item.productId, size: item.size as string } },
        update: { quantity: { increment: item.quantity } },
        create: { productId: item.productId, size: item.size, quantity: item.quantity },
      });
    }

    if (latestSlip && note) {
      await tx.merchPaymentSlip.update({
        where: { id: latestSlip.id },
        data: { verifiedBy: admin!.adminId, verifiedAt: new Date(), note },
      });
    }
    return true;
  });

  if (!updated) {
    return jsonError("สถานะการสั่งซื้อไม่สามารถปฏิเสธได้ (มีการดำเนินการไปแล้ว)", 409);
  }

  return NextResponse.json({ ok: true });
}
