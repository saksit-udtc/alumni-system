import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { addDays, getLedgerRange, isDateStr, todayBkk } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "FINANCE_STAFF"]);
  if (response) return response;
  const to = req.nextUrl.searchParams.get("to") || todayBkk();
  const from = req.nextUrl.searchParams.get("from") || addDays(to, -29);
  if (!isDateStr(from) || !isDateStr(to)) return jsonError("รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)");
  if (from > to) return jsonError("วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด");
  if (Date.parse(to) - Date.parse(from) > 366 * 86400000) return jsonError("เลือกช่วงวันที่ได้ไม่เกิน 1 ปี");
  return NextResponse.json(await getLedgerRange(from, to));
}
