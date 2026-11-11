import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { bkkDateKey, getPosDailySummary, isDateStr } from "@/lib/posDailySummary";
import { releaseExpiredPosSales } from "@/lib/posSale";

export const dynamic = "force-dynamic";

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EFE6" } };
  });
}

/** สรุปยอดขายหน้างานรายวัน: ?from=YYYY-MM-DD&to=YYYY-MM-DD (ค่าเริ่มต้น = 30 วันล่าสุด), &format=xlsx เพื่อ Export */
export async function GET(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["MERCH_STAFF"]);
  if (!admin) return response;

  const sp = req.nextUrl.searchParams;
  const today = bkkDateKey(new Date());
  const to = isDateStr(sp.get("to")) ? (sp.get("to") as string) : today;
  const from = isDateStr(sp.get("from"))
    ? (sp.get("from") as string)
    : bkkDateKey(new Date(new Date(`${to}T00:00:00+07:00`).getTime() - 29 * 86400000));
  if (from > to) return jsonError("INVALID_RANGE");
  if ((new Date(to).getTime() - new Date(from).getTime()) / 86400000 > 366) return jsonError("RANGE_TOO_LONG");

  await releaseExpiredPosSales().catch(() => {});
  const s = await getPosDailySummary(from, to);

  if (sp.get("format") !== "xlsx") return NextResponse.json({ summary: s });

  const wb = new ExcelJS.Workbook();
  const stamp = new Date(s.generatedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
  const period = from === to ? from : `${from} ถึง ${to}`;
  const money = "#,##0.00";

  // ---- สรุปรายวัน ----
  const ws = wb.addWorksheet("สรุปรายวัน");
  ws.addRow([`สรุปยอดขายหน้างาน (POS) รายวัน — ${period}`]).font = { bold: true, size: 13 };
  ws.addRow([`นับเฉพาะรายการที่ชำระแล้ว ตามวันที่รับเงิน · ข้อมูล ณ ${stamp}`]).font = { italic: true, color: { argb: "FF78716C" } };
  ws.addRow([]);
  styleHeader(ws.addRow(["วันที่", "จำนวนบิล", "จำนวนชิ้น", "เงินสด (บาท)", "บิลเงินสด", "โอนเงิน (บาท)", "บิลโอนเงิน", "ยอดรวม (บาท)"]));
  for (const d of s.days) ws.addRow([d.date, d.bills, d.items, d.cash, d.cashBills, d.transfer, d.transferBills, d.total]);
  const t = s.totals;
  ws.addRow(["รวมทั้งหมด", t.bills, t.items, t.cash, t.cashBills, t.transfer, t.transferBills, t.total]).font = { bold: true };
  ws.columns = [{ width: 18 }, { width: 11 }, { width: 11 }, { width: 16 }, { width: 11 }, { width: 16 }, { width: 12 }, { width: 18 }];
  for (const c of [4, 6, 8]) ws.getColumn(c).numFmt = money;

  // ---- สรุปตามสินค้า ----
  const wp = wb.addWorksheet("สรุปตามสินค้า");
  wp.addRow([`ยอดขายแยกตามสินค้า — ${period}`]).font = { bold: true, size: 13 };
  wp.addRow([]);
  styleHeader(wp.addRow(["สินค้า", "ไซซ์", "จำนวน (ชิ้น)", "ยอดเงิน (บาท)"]));
  for (const p of s.products) wp.addRow([p.productName, p.size ?? "-", p.qty, p.amount]);
  wp.addRow(["รวมทั้งหมด", "", t.items, t.total]).font = { bold: true };
  wp.columns = [{ width: 36 }, { width: 8 }, { width: 14 }, { width: 18 }];
  wp.getColumn(4).numFmt = money;

  // ---- สินค้าแยกรายวัน ----
  const wd = wb.addWorksheet("สินค้าแยกรายวัน");
  styleHeader(wd.addRow(["วันที่", "สินค้า", "ไซซ์", "จำนวน (ชิ้น)", "ยอดเงิน (บาท)"]));
  for (const p of s.dailyProducts) wd.addRow([p.date, p.productName, p.size ?? "-", p.qty, p.amount]);
  wd.columns = [{ width: 14 }, { width: 36 }, { width: 8 }, { width: 14 }, { width: 18 }];
  wd.getColumn(5).numFmt = money;

  // ---- รายการบิล ----
  const wb2 = wb.addWorksheet("รายการบิล");
  styleHeader(wb2.addRow(["วันที่", "เวลา", "เลขที่บิล", "ผู้ขาย", "วิธีชำระ", "ผู้ซื้อ", "จำนวนชิ้น", "ยอดรวม (บาท)"]));
  for (const b of s.bills) wb2.addRow([b.date, b.time, b.saleCode, b.cashier, b.method === "cash" ? "เงินสด" : "โอนเงิน", b.buyer || "-", b.items, b.total]);
  wb2.columns = [{ width: 14 }, { width: 8 }, { width: 14 }, { width: 16 }, { width: 11 }, { width: 24 }, { width: 11 }, { width: 16 }];
  wb2.getColumn(8).numFmt = money;

  const buf = await wb.xlsx.writeBuffer();
  const fname = `pos-daily-sales-${from}_${to}.xlsx`;
  return new NextResponse(buf as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}
