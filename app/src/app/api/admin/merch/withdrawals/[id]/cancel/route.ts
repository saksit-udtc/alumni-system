import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { cancelWithdrawal } from "@/lib/merchWithdrawal";
import { logAdminAction } from "@/lib/auditLog";

export const dynamic = "force-dynamic";

/** ยกเลิกใบเบิก + คืนสต๊อก — เฉพาะ SUPER_ADMIN (กันเจ้าหน้าที่ยกเลิกหลักฐานเอง) */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (!admin) return response;
  const b = await req.json().catch(() => ({}));
  const reason = (typeof b?.reason === "string" ? b.reason.trim() : "") || "manual";
  const w = await prisma.merchWithdrawal.findUnique({ where: { id: params.id }, select: { id: true, code: true } });
  if (!w) return jsonError("ไม่พบใบเบิก", 404);
  const ok = await cancelWithdrawal(w.id, reason);
  if (!ok) return jsonError("ใบเบิกนี้ถูกยกเลิกไปแล้ว", 409);
  await logAdminAction({ adminId: admin.adminId, action: "MERCH_WITHDRAWAL_CANCEL", targetType: "MerchWithdrawal", targetId: w.id, detail: `${w.code} ยกเลิก: ${reason} (คืนสต๊อกแล้ว)` });
  return NextResponse.json({ ok: true });
}
