import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { bkkDateKey, isDateStr } from "@/lib/posDailySummary";
import { getOnlineDailySummary } from "@/lib/onlineDailySummary";

export const dynamic = "force-dynamic";

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EFE6" } };
  });
}

/** สรุปยอดขายออนไลน์รายวัน: ?from=YYYY-MM-DD&to=YYYY-MM-DD (ค่าเริ่มต้น = 30 วันล่าสุด), &format=xlsx เพื่อ Export */
export async function GET(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["MERCH_STAFF", "FINANCE_STAFF"]);
  if (!admin) return response;

  const sp = req.nextUrl.searchParams;
  const today = bkkDateKey(new Date());
  const to = isDateStr(sp.get("to")) ? (sp.get("to") as string) : today;
  const from = isDateStr(sp.get("from"))
    ? (sp.get("from") as string)
    : bkkDateKey(new Date(new Date(`${to}T00:00:00+07:00`).getTime() - 29 * 86400000));
  if (from > to) return jsonError("INVALID_RANGE");
  if ((new Date(to).getTime() - new Date(from).getTime()) / 86400000 > 366) return jsonError("RANGE_TOO_LONG");

  const s = await getOnlineDailySummary(from, to);
  if (sp.get("format") !== "xlsx") return NextResponse.json({ summary: s });

  const wb = new ExcelJS.Workbook();
  const stamp = new Date(s.generatedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
  const period = from === to ? from : `${from} ถึง ${to}`;
  const money = "#,##0.00";
  const t = s.totals;

  // ---- สรุปรายวัน ----
  const ws = wb.addWorksheet("สรุปรายวัน");
  ws.addRow([`สรุปยอดขายออนไลน์รายวัน — ${period}`]).font = { bold: true, size: 13 };
  ws.addRow([`นับเฉพาะคำสั่งซื้อที่ยืนยันแล้ว ตามวันที่ยืนยันสลิป · ข้อมูล ณ ${stamp}`]).font = { italic: true, color: { argb: "FF78716C" } };
  ws.addRow([]);
  styleHeader(ws.addRow(["วันที่", "จำนวนออเดอร์", "จำนวนชิ้น", "ค่าสินค้า (บาท)", "ค่าจัดส่ง (บาท)", "ยอดรวม (บาท)"]));
  for (const d of s.days) ws.addRow([d.date, d.orders, d.items, d.goods, d.shipping, d.total]);
  ws.addRow(["รวมทั้งหมด", t.orders, t.items, t.goods, t.shipping, t.total]).font = { bold: true };
  ws.columns = [{ width: 18 }, { width: 14 }, { width: 11 }, { width: 18 }, { width: 18 }, { width: 18 }];
  for (const c of [4, 5, 6]) ws.getColumn(c).numFmt = money;

  // ---- สรุปตามสินค้า ----
  const wp = wb.addWorksheet("สรุปตามสินค้า");
  wp.addRow([`ยอดขายออนไลน์แยกตามสินค้า — ${period}`]).font = { bold: true, size: 13 };
  wp.addRow([]);
  styleHeader(wp.addRow(["สินค้า", "ไซซ์", "จำนวน (ชิ้น)", "ยอดเงิน (บาท)"]));
  for (const p of s.products) wp.addRow([p.productName, p.size ?? "-", p.qty, p.amount]);
  wp.addRow(["รวมทั้งหมด", "", t.items, t.goods]).font = { bold: true };
  wp.columns = [{ width: 36 }, { width: 8 }, { width: 14 }, { width: 18 }];
  wp.getColumn(4).numFmt = money;

  // ---- สินค้าแยกรายวัน ----
  const wd = wb.addWorksheet("สินค้าแยกรายวัน");
  styleHeader(wd.addRow(["วันที่", "สินค้า", "ไซซ์", "จำนวน (ชิ้น)", "ยอดเงิน (บาท)"]));
  for (const p of s.dailyProducts) wd.addRow([p.date, p.productName, p.size ?? "-", p.qty, p.amount]);
  wd.columns = [{ width: 14 }, { width: 36 }, { width: 8 }, { width: 14 }, { width: 18 }];
  wd.getColumn(5).numFmt = money;

  // ---- รายการออเดอร์ ----
  const wo = wb.addWorksheet("รายการออเดอร์");
  styleHeader(wo.addRow(["วันที่", "เวลา", "เลขที่ออเดอร์", "ผู้สั่งซื้อ", "การรับสินค้า", "จำนวนชิ้น", "ค่าสินค้า (บาท)", "ค่าจัดส่ง (บาท)", "ยอดรวม (บาท)"]));
  for (const o of s.orders) wo.addRow([o.date, o.time, o.orderCode, o.buyer || "-", o.delivery, o.items, o.goods, o.shipping, o.total]);
  wo.columns = [{ width: 14 }, { width: 8 }, { width: 14 }, { width: 28 }, { width: 16 }, { width: 11 }, { width: 16 }, { width: 16 }, { width: 16 }];
  for (const c of [7, 8, 9]) wo.getColumn(c).numFmt = money;

  const buf = await wb.xlsx.writeBuffer();
  const fname = `online-daily-sales-${from}_${to}.xlsx`;
  return new NextResponse(buf as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}
