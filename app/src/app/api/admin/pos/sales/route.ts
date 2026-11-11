import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { createPosSale, PosSaleError, releaseExpiredPosSales } from "@/lib/posSale";
import { logAdminAction } from "@/lib/auditLog";

// Plain GET, no dynamic route segment, reads the DB — force-dynamic (see
// note in ../products/route.ts).
export const dynamic = "force-dynamic";

/** Sales history for the POS — most recent first, capped at 200 rows. */
export async function GET(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["MERCH_STAFF"]);
  if (!admin) return response;

  // ปล่อยใบโอนเงินที่หมดเวลาก่อนแสดง ให้ประวัติ/สต๊อกตรงกับความจริงเสมอ
  await releaseExpiredPosSales().catch((err) => console.error("releaseExpiredPosSales failed", err));

  const sales = await prisma.posSale.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { items: true, cashier: { select: { username: true } }, package: { select: { name: true } } },
  });

  return NextResponse.json({ sales });
}

/**
 * Creates one POS sale from a scanned cart and decrements stock atomically,
 * see lib/posSale.ts. ทุกวิธีชำระ (เงินสด/โอนเงิน) = สถานะ "รอชำระ" (กันสต๊อกไว้)
 * จนกว่าผู้ขายจะกดยืนยันรับเงินที่ POST /api/admin/pos/sales/[id]/confirm
 */
export async function POST(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["MERCH_STAFF"]);
  if (!admin) return response;

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.items)) {
    return jsonError("INVALID_BODY");
  }

  try {
    const sale = await createPosSale({
      cashierId: admin.adminId,
      paymentMethod: body.paymentMethod,
      buyerName: typeof body.buyerName === "string" ? body.buyerName : undefined,
      buyerPhone: typeof body.buyerPhone === "string" ? body.buyerPhone : undefined,
      items: body.items,
    });

    await logAdminAction({
      adminId: admin.adminId,
      action: "POS_SALE_CREATE",
      targetType: "PosSale",
      targetId: sale.id,
      detail: `${sale.saleCode} - ${Number(sale.totalAmount).toLocaleString()} บาท (${sale.paymentMethod})${sale.status === "pending" ? " [รอชำระ]" : ""}`,
    });

    return NextResponse.json({ sale });
  } catch (err) {
    if (err instanceof PosSaleError) {
      return jsonError(err.message, 400);
    }
    console.error("createPosSale failed", err);
    return jsonError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง", 500);
  }
}
