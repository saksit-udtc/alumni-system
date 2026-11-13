import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { createWithdrawal, WithdrawalError } from "@/lib/merchWithdrawal";
import { logAdminAction } from "@/lib/auditLog";

export const dynamic = "force-dynamic";

/** รายการใบเบิกของที่ระลึก (ล่าสุดก่อน 200 รายการ) */
export async function GET(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["MERCH_STAFF"]);
  if (!admin) return response;
  const withdrawals = await prisma.merchWithdrawal.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { items: true, createdBy: { select: { username: true } } },
  });
  return NextResponse.json({ withdrawals, canCancel: admin.role === "SUPER_ADMIN" });
}

/** สร้างใบเบิก + ตัดสต๊อก (SUPER_ADMIN / MERCH_STAFF) — ต้องระบุผู้เบิก วัตถุประสงค์ ผู้อนุมัติ */
export async function POST(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["MERCH_STAFF"]);
  if (!admin) return response;
  const b = await req.json().catch(() => null);
  if (!b || !Array.isArray(b.items)) return jsonError("INVALID_BODY");
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  try {
    const w = await createWithdrawal({
      createdById: admin.adminId,
      requesterName: s(b.requesterName),
      requesterPosition: s(b.requesterPosition),
      purpose: s(b.purpose),
      approverName: s(b.approverName),
      note: s(b.note),
      items: b.items.map((i: any) => ({ stockId: s(i?.stockId), quantity: Number(i?.quantity) })),
    });
    const qty = w.items.reduce((n, i) => n + i.quantity, 0);
    await logAdminAction({
      adminId: admin.adminId,
      action: "MERCH_WITHDRAWAL_CREATE",
      targetType: "MerchWithdrawal",
      targetId: w.id,
      detail: `${w.code} ผู้เบิก ${w.requesterName} / ${w.purpose} / อนุมัติโดย ${w.approverName} (${qty} ชิ้น)`,
    });
    return NextResponse.json({ withdrawal: w });
  } catch (err) {
    if (err instanceof WithdrawalError) return jsonError(err.message, 400);
    console.error("createWithdrawal failed", err);
    return jsonError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง", 500);
  }
}
