import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { logAdminAction } from "@/lib/auditLog";

/**
 * Admin "reject slip" for a merch order. Merch orders have no seat/table to
 * release, so — unlike the reservation reject route — this is a plain
 * atomic updateMany race-guard transition instead of going through
 * releaseReservation.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF", "FINANCE_STAFF"]);
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
    // the product/size becomes purchasable again. Manual find-then-update/
    // create (not upsert) because a size row could in theory have been
    // removed by the admin after the order was placed, and because
    // Prisma's compound-unique `where` (productId_size) rejects a literal
    // null for the nullable `size` half even though the column itself is
    // nullable. Skips items whose product was deleted since the order was
    // placed (productId is nullable now that products can be deleted even
    // with order history) — there's no stock row to restore to.
    for (const item of order.items) {
      if (!item.productId) continue;
      const existing = await tx.merchProductStock.findFirst({
        where: { productId: item.productId, size: item.size },
      });
      if (existing) {
        await tx.merchProductStock.update({
          where: { id: existing.id },
          data: { quantity: { increment: item.quantity } },
        });
      } else {
        await tx.merchProductStock.create({
          data: { productId: item.productId, size: item.size, quantity: item.quantity },
        });
      }
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

  await logAdminAction({
    adminId: admin!.adminId,
    action: "MERCH_ORDER_REJECT",
    targetType: "MerchOrder",
    targetId: order.id,
    detail: `orderCode=${order.orderCode}`,
  });

  return NextResponse.json({ ok: true });
}
