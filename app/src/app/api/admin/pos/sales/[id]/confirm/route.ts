import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { confirmPosSalePayment, PosSaleError } from "@/lib/posSale";
import { logAdminAction } from "@/lib/auditLog";

/**
 * ผู้ขายยืนยันว่าเงินโอนเข้าบัญชีแล้ว → ใบขายเปลี่ยนจาก "รอชำระ" เป็น "ชำระแล้ว"
 * (จากนั้นพิมพ์ใบเสร็จได้) กดซ้ำได้ ไม่เป็นไร
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req, ["MERCH_STAFF"]);
  if (!admin) return response;

  try {
    await confirmPosSalePayment(params.id);
  } catch (err) {
    if (err instanceof PosSaleError) return jsonError(err.message, err.code === "NOT_FOUND" ? 404 : 400);
    console.error("confirmPosSalePayment failed", err);
    return jsonError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง", 500);
  }

  const sale = await prisma.posSale.findUnique({
    where: { id: params.id },
    include: { items: true, cashier: { select: { username: true } }, package: { select: { name: true } } },
  });
  if (!sale) return jsonError("NOT_FOUND", 404);

  await logAdminAction({
    adminId: admin.adminId,
    action: "POS_SALE_CONFIRM_PAYMENT",
    targetType: "PosSale",
    targetId: sale.id,
    detail: `${sale.saleCode} - ยืนยันรับเงิน ${Number(sale.totalAmount).toLocaleString()} บาท`,
  });

  return NextResponse.json({ sale });
}
