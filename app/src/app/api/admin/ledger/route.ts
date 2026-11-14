import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { getLedgerDay, isDateStr, todayBkk, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "@/lib/ledger";

export const dynamic = "force-dynamic";

// สมุดบัญชีรายวัน — เฉพาะผู้ดูแลสูงสุดและเจ้าหน้าที่การเงิน

export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "FINANCE_STAFF"]);
  if (response) return response;
  const date = req.nextUrl.searchParams.get("date") || todayBkk();
  if (!isDateStr(date)) return jsonError("รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)");
  const day = await getLedgerDay(date);
  return NextResponse.json({ ...day, categories: { income: INCOME_CATEGORIES, expense: EXPENSE_CATEGORIES } });
}
