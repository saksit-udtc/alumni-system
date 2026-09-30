import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireAdmin } from "@/lib/apiHelpers";
import { getSalesSummary } from "@/lib/salesSummary";

export const dynamic = "force-dynamic";

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EFE6" } };
  });
}

export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF", "FINANCE_STAFF", "RESERVATION_STAFF"]);
  if (response) return response;

  const s = await getSalesSummary();
  const stamp = new Date(s.generatedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
  const wb = new ExcelJS.Workbook();

  // ---- ของที่ระลึก ----
  const ws = wb.addWorksheet("สรุปของที่ระลึก");
  ws.addRow([`สรุปจำนวนสินค้าที่ระลึกที่ถูกสั่ง — ข้อมูล ณ ${stamp}`]).font = { bold: true, size: 13 };
  ws.addRow(["ไม่นับรายการที่ถูกปฏิเสธหรือหมดเวลา · ขายหน้างาน (POS) นับเป็นยืนยันแล้ว"]).font = { italic: true, color: { argb: "FF78716C" } };
  ws.addRow([]);
  styleHeader(ws.addRow(["สินค้า", "ไซซ์", "ยืนยันแล้ว", "รอตรวจสลิป", "รอชำระ", "รวม", "สั่งออนไลน์", "ขายหน้างาน", "แพ็กเกจจองโต๊ะ", "ยอดเงินยืนยันแล้ว (บาท)"]));
  for (const r of s.merch) {
    ws.addRow([r.productName, r.size ?? "-", r.confirmed, r.awaiting, r.pending, r.total, r.online, r.pos, r.withTable, r.revenueConfirmed]);
  }
  const t = s.merchTotals;
  ws.addRow(["รวมทั้งหมด", "", t.confirmed, t.awaiting, t.pending, t.total, t.online, t.pos, t.withTable, t.revenueConfirmed]).font = { bold: true };
  ws.columns = [{ width: 32 }, { width: 8 }, { width: 11 }, { width: 12 }, { width: 10 }, { width: 9 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 20 }];
  ws.getColumn(10).numFmt = "#,##0";

  // ---- โต๊ะ ----
  const wt = wb.addWorksheet("สรุปการจองโต๊ะ");
  wt.addRow([`สรุปการจองโต๊ะ — ข้อมูล ณ ${stamp}`]).font = { bold: true, size: 13 };
  for (const e of s.events) {
    wt.addRow([]);
    wt.addRow([e.eventName]).font = { bold: true, size: 12 };
    styleHeader(wt.addRow(["รายการ", "ยืนยันแล้ว", "รอตรวจสลิป", "รอชำระ", "รวม"]));
    const line = (label: string, v: Record<string, number>) =>
      wt.addRow([label, v.confirmed, v.awaiting, v.pending, v.confirmed + v.awaiting + v.pending]);
    line("โต๊ะที่มีการจอง", e.tables);
    line("การจองแบบเต็มโต๊ะ", e.fullTableBookings);
    line("การจองแบบรายที่นั่ง", e.seatBookings);
    line("ที่นั่งที่ถูกจอง", e.seats);
    line("ยอดเงิน (บาท)", e.revenue);
    wt.addRow(["โต๊ะว่าง", "", "", "", e.freeTables]);
    wt.addRow(["โต๊ะทั้งหมด / ที่นั่งทั้งหมด", "", "", "", `${e.totalTables} / ${e.totalSeats}`]);
    wt.addRow([]);
    styleHeader(wt.addRow(["โซน", "ยืนยันแล้ว", "รอตรวจสลิป", "รอชำระ", "ว่าง", "โต๊ะทั้งหมด"]));
    for (const z of e.zones) wt.addRow([z.zone, z.confirmed, z.awaiting, z.pending, z.free, z.tables]);
  }
  wt.columns = [{ width: 28 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 14 }, { width: 12 }];

  const buf = await wb.xlsx.writeBuffer();
  const fname = `sales-summary-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buf as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}
