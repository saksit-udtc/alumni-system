import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { addDays, dbDate, fromDbDate, getAutoIncomeItems, getLedgerRange, isDateStr, isStream, SOURCE_LABEL, SOURCE_STREAM, STREAMS, STREAM_LABEL, todayBkk, LEDGER_MANUAL_AND_CLOSING_ENABLED } from "@/lib/ledger";

export const dynamic = "force-dynamic";

const METHOD_LABEL = { cash: "เงินสด", transfer: "โอน" } as const;

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EFE6" } };
  });
}

export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "FINANCE_STAFF"]);
  if (response) return response;
  const to = req.nextUrl.searchParams.get("to") || todayBkk();
  const from = req.nextUrl.searchParams.get("from") || addDays(to, -29);
  if (!isDateStr(from) || !isDateStr(to) || from > to) return jsonError("ช่วงวันที่ไม่ถูกต้อง");
  if (Date.parse(to) - Date.parse(from) > 366 * 86400000) return jsonError("เลือกช่วงวันที่ได้ไม่เกิน 1 ปี");

  const [range, items, entries] = await Promise.all([
    getLedgerRange(from, to),
    getAutoIncomeItems(from, to),
    prisma.ledgerEntry.findMany({ where: { entryDate: { gte: dbDate(from), lte: dbDate(to) } }, orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }] }),
  ]);

  const wb = new ExcelJS.Workbook();

  const w1 = wb.addWorksheet("สรุปรายวัน");
  w1.addRow([from === to ? `สมุดบัญชีรายวัน วันที่ ${from}` : `สมุดบัญชีรายวัน ${from} ถึง ${to}`]).font = { bold: true, size: 13 };
  w1.addRow([]);
  // ปิดฟีเจอร์กรอกรายการเอง/ปิดยอดอยู่ → ไม่ใส่คอลัมน์สถานะปิดยอดและผลต่าง (ให้ตรงกับหน้าเว็บที่ซ่อนไว้)
  const ON = LEDGER_MANUAL_AND_CLOSING_ENABLED;
  styleHeader(w1.addRow(["วันที่", "รายรับจากระบบ", "รายรับกรอกเอง", "รายจ่าย", "คงเหลือสุทธิ", ...(ON ? ["สถานะ", "ผลต่างหลังปิดยอด"] : [])]));
  for (const r of range.rows) {
    w1.addRow([r.date, r.auto, r.manualIncome, r.expense, r.net, ...(ON ? [r.closed ? "ปิดยอดแล้ว" : "ยังไม่ปิดยอด", r.drift ?? ""] : [])]);
  }
  const t = range.totals;
  w1.addRow(["รวม", t.auto, t.manualIncome, t.expense, t.net, ...(ON ? [`ปิดแล้ว ${t.closedDays} / ยังไม่ปิด ${t.openDays}`, ""] : [])]).font = { bold: true };
  w1.columns = [{ width: 14 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 16 }, ...(ON ? [{ width: 22 }, { width: 18 }] : [])];
  for (const c of ON ? [2, 3, 4, 5, 7] : [2, 3, 4, 5]) w1.getColumn(c).numFmt = "#,##0.00";

  const w2 = wb.addWorksheet("รายรับจากระบบ");
  styleHeader(w2.addRow(["วันที่", "แหล่งที่มา", "หมวดงาน", "รหัสอ้างอิง", "ชื่อ", "ช่องทาง", "จำนวนเงิน (บาท)"]));
  for (const i of items.sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref))) {
    w2.addRow([i.date, SOURCE_LABEL[i.source], STREAM_LABEL[SOURCE_STREAM[i.source]], i.ref, i.name ?? "", METHOD_LABEL[i.method], i.amount]);
  }
  w2.columns = [{ width: 14 }, { width: 36 }, { width: 22 }, { width: 18 }, { width: 24 }, { width: 10 }, { width: 18 }];
  w2.getColumn(7).numFmt = "#,##0.00";

  if (ON) {
  const w3 = wb.addWorksheet("รายการกรอกเอง");
  styleHeader(w3.addRow(["วันที่", "ประเภท", "หมวด", "หมวดงาน", "ช่องทาง", "จำนวนเงิน (บาท)", "รายละเอียด", "เลขที่ใบเสร็จ", "ผู้บันทึก", "สถานะ"]));
  for (const e of entries) {
    w3.addRow([
      fromDbDate(e.entryDate), e.type === "income" ? "รายรับ" : "รายจ่าย", e.category, STREAM_LABEL[isStream(e.stream) ? e.stream : "general"], METHOD_LABEL[e.method], Number(e.amount),
      e.description ?? "", e.receiptNo ?? "", e.createdByName ?? "", e.voidedAt ? `ยกเลิก: ${e.voidReason ?? ""}` : "ใช้งาน",
    ]);
  }
  w3.columns = [{ width: 14 }, { width: 10 }, { width: 28 }, { width: 22 }, { width: 10 }, { width: 18 }, { width: 32 }, { width: 16 }, { width: 16 }, { width: 28 }];
  w3.getColumn(6).numFmt = "#,##0.00";
  }

  const w5 = wb.addWorksheet("แยกตามหมวดงาน");
  w5.addRow([from === to ? `กำไร-ขาดทุนแยกตามหมวดงาน วันที่ ${from}` : `กำไร-ขาดทุนแยกตามหมวดงาน ${from} ถึง ${to}`]).font = { bold: true, size: 13 };
  w5.addRow(["รายรับ = รายรับจากระบบ + รายรับกรอกเอง · การจองแพ็กเกจ (โต๊ะ + ของที่ระลึก) นับเป็นงานเลี้ยงทั้งก้อน"]).font = { italic: true, color: { argb: "FF78716C" } };
  w5.addRow([]);
  styleHeader(w5.addRow(["หมวดงาน", "รายรับ", "รายจ่าย", "คงเหลือ"]));
  for (const k of STREAMS) w5.addRow([STREAM_LABEL[k], range.byStream[k].income, range.byStream[k].expense, range.byStream[k].net]);
  const sum = (f: "income" | "expense" | "net") => STREAMS.reduce((a, k) => a + range.byStream[k][f], 0);
  w5.addRow(["รวม", sum("income"), sum("expense"), sum("net")]).font = { bold: true };
  w5.columns = [{ width: 28 }, { width: 16 }, { width: 16 }, { width: 16 }];
  for (const c of [2, 3, 4]) w5.getColumn(c).numFmt = "#,##0.00";

  const w4 = wb.addWorksheet("รายจ่ายแยกหมวด");
  styleHeader(w4.addRow(["หมวด", "จำนวนเงิน (บาท)"]));
  for (const c of range.expenseByCategory) w4.addRow([c.category, c.amount]);
  w4.columns = [{ width: 32 }, { width: 18 }];
  w4.getColumn(2).numFmt = "#,##0.00";

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ledger-${from === to ? from : `${from}_${to}`}.xlsx"`,
    },
  });
}
