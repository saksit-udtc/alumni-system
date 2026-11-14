import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { logAdminAction } from "@/lib/auditLog";
import { dbDate, defaultStream, isDateStr, isStream, round2, todayBkk, toEntryRow, LEDGER_MANUAL_AND_CLOSING_ENABLED } from "@/lib/ledger";

export const dynamic = "force-dynamic";

// เพิ่มรายการที่กรอกเอง (รายจ่าย / เงินสดรับอื่นๆ)
export async function POST(req: NextRequest) {
  if (!LEDGER_MANUAL_AND_CLOSING_ENABLED) return jsonError("ฟีเจอร์นี้ถูกปิดใช้งาน", 403);
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN", "FINANCE_STAFF"]);
  if (response) return response;

  const b = await req.json().catch(() => null);
  if (!b) return jsonError("ข้อมูลไม่ถูกต้อง");
  const date = b.date;
  if (!isDateStr(date)) return jsonError("วันที่ไม่ถูกต้อง");
  if (date > todayBkk()) return jsonError("บันทึกล่วงหน้าไม่ได้");
  if (b.type !== "income" && b.type !== "expense") return jsonError("ประเภทรายการไม่ถูกต้อง");
  const method = b.method === "transfer" ? "transfer" : "cash";
  const category = typeof b.category === "string" ? b.category.trim().slice(0, 80) : "";
  if (!category) return jsonError("กรุณาเลือกหมวดหมู่");
  const stream = b.stream === undefined || b.stream === "" ? defaultStream(category) : b.stream;
  if (!isStream(stream)) return jsonError("หมวดงานไม่ถูกต้อง");
  const amount = round2(Number(b.amount));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) return jsonError("จำนวนเงินไม่ถูกต้อง");
  const description = typeof b.description === "string" && b.description.trim() ? b.description.trim().slice(0, 300) : null;
  const receiptNo = typeof b.receiptNo === "string" && b.receiptNo.trim() ? b.receiptNo.trim().slice(0, 60) : null;

  // วันที่ปิดยอดแล้วแก้ไม่ได้ — ต้องให้ผู้ดูแลสูงสุดเปิดยอดก่อน
  const closed = await prisma.dailyClosing.findUnique({ where: { closingDate: dbDate(date) }, select: { id: true } });
  if (closed) return jsonError("วันนี้ปิดยอดแล้ว ต้องเปิดยอดก่อนจึงจะเพิ่มรายการได้", 409);

  const row = await prisma.ledgerEntry.create({
    data: { entryDate: dbDate(date), type: b.type, method, category, stream, amount, description, receiptNo, createdById: admin!.adminId, createdByName: admin!.username },
  });
  await logAdminAction({ adminId: admin!.adminId, action: "LEDGER_ENTRY_CREATE", targetType: "LedgerEntry", targetId: row.id, detail: `${b.type} ${amount} ${category} [${stream}] ${date}` });
  return NextResponse.json(toEntryRow(row), { status: 201 });
}
