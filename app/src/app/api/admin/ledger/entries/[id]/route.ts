import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { logAdminAction } from "@/lib/auditLog";
import { LEDGER_MANUAL_AND_CLOSING_ENABLED } from "@/lib/ledger";

export const dynamic = "force-dynamic";

// ยกเลิกรายการ (void) — ไม่ลบจริง เก็บเหตุผลไว้ตรวจสอบย้อนหลัง
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!LEDGER_MANUAL_AND_CLOSING_ENABLED) return jsonError("ฟีเจอร์นี้ถูกปิดใช้งาน", 403);
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN", "FINANCE_STAFF"]);
  if (response) return response;

  const b = await req.json().catch(() => null);
  const reason = typeof b?.reason === "string" ? b.reason.trim().slice(0, 200) : "";
  if (!reason) return jsonError("กรุณาระบุเหตุผลที่ยกเลิก");

  const entry = await prisma.ledgerEntry.findUnique({ where: { id: params.id } });
  if (!entry) return jsonError("ไม่พบรายการ", 404);
  if (entry.voidedAt) return jsonError("รายการนี้ถูกยกเลิกไปแล้ว", 409);
  const closed = await prisma.dailyClosing.findUnique({ where: { closingDate: entry.entryDate }, select: { id: true } });
  if (closed) return jsonError("วันนี้ปิดยอดแล้ว ต้องเปิดยอดก่อนจึงจะยกเลิกรายการได้", 409);

  await prisma.ledgerEntry.update({ where: { id: entry.id }, data: { voidedAt: new Date(), voidReason: reason, voidedByName: admin!.username } });
  await logAdminAction({ adminId: admin!.adminId, action: "LEDGER_ENTRY_VOID", targetType: "LedgerEntry", targetId: entry.id, detail: reason });
  return NextResponse.json({ ok: true });
}
