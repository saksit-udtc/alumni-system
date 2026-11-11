import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { cancelPendingPosSale } from "@/lib/posSale";
import { logAdminAction } from "@/lib/auditLog";

/** ยกเลิกใบ "รอชำระ" (ลูกค้าไม่จ่าย/ผู้ขายกดผิด) + คืนสต๊อก — ยกเลิกใบที่ชำระแล้วไม่ได้ผ่านทางนี้ */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req, ["MERCH_STAFF"]);
  if (!admin) return response;

  const before = await prisma.posSale.findUnique({ where: { id: params.id }, select: { saleCode: true, status: true } });
  if (!before) return jsonError("NOT_FOUND", 404);
  if (before.status === "paid") return jsonError("ใบขายนี้ชำระแล้ว ยกเลิกจากหน้านี้ไม่ได้", 400);

  const cancelled = await cancelPendingPosSale(params.id, "manual");

  if (cancelled) {
    await logAdminAction({
      adminId: admin.adminId,
      action: "POS_SALE_CANCEL",
      targetType: "PosSale",
      targetId: params.id,
      detail: `${before.saleCode} - ยกเลิกใบรอชำระและคืนสต๊อก`,
    });
  }

  const sale = await prisma.posSale.findUnique({
    where: { id: params.id },
    include: { items: true, cashier: { select: { username: true } }, package: { select: { name: true } } },
  });
  return NextResponse.json({ sale });
}
