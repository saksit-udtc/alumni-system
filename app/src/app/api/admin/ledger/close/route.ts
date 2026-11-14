import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { logAdminAction } from "@/lib/auditLog";
import { closeDay, dbDate, isDateStr, LedgerError, LEDGER_MANUAL_AND_CLOSING_ENABLED } from "@/lib/ledger";

export const dynamic = "force-dynamic";

// ปิดยอดประจำวัน
export async function POST(req: NextRequest) {
  if (!LEDGER_MANUAL_AND_CLOSING_ENABLED) return jsonError("ฟีเจอร์นี้ถูกปิดใช้งาน", 403);
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN", "FINANCE_STAFF"]);
  if (response) return response;
  const b = await req.json().catch(() => null);
  if (!b || !isDateStr(b.date)) return jsonError("วันที่ไม่ถูกต้อง");
  let counted: number | null = null;
  if (b.countedCash !== undefined && b.countedCash !== null && b.countedCash !== "") {
    counted = Number(b.countedCash);
    if (!Number.isFinite(counted) || counted < 0) return jsonError("ยอดเงินสดที่นับได้ไม่ถูกต้อง");
  }
  try {
    const day = await closeDay(b.date, { adminId: admin!.adminId, username: admin!.username }, { note: typeof b.note === "string" ? b.note.slice(0, 300) : null, countedCash: counted });
    await logAdminAction({ adminId: admin!.adminId, action: "LEDGER_CLOSE_DAY", targetType: "DailyClosing", targetId: b.date, detail: `net=${day.net} expectedCash=${day.expectedCash} counted=${counted ?? "-"}` });
    return NextResponse.json(day);
  } catch (e) {
    if (e instanceof LedgerError) return jsonError(e.message, e.status);
    throw e;
  }
}

// เปิดยอดใหม่ (ยกเลิกการปิดยอด) — เฉพาะผู้ดูแลสูงสุด
export async function DELETE(req: NextRequest) {
  if (!LEDGER_MANUAL_AND_CLOSING_ENABLED) return jsonError("ฟีเจอร์นี้ถูกปิดใช้งาน", 403);
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;
  const date = req.nextUrl.searchParams.get("date");
  if (!isDateStr(date)) return jsonError("วันที่ไม่ถูกต้อง");
  const closing = await prisma.dailyClosing.findUnique({ where: { closingDate: dbDate(date) } });
  if (!closing) return jsonError("วันนี้ยังไม่ได้ปิดยอด", 404);
  await prisma.dailyClosing.delete({ where: { id: closing.id } });
  await logAdminAction({ adminId: admin!.adminId, action: "LEDGER_REOPEN_DAY", targetType: "DailyClosing", targetId: date, detail: `เดิม net=${closing.net} ปิดโดย ${closing.closedByName ?? "-"}` });
  return NextResponse.json({ ok: true });
}
