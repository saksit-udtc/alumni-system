import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiHelpers";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "รอชำระเงิน",
  awaiting_verify: "รอตรวจสอบสลิป",
  confirmed: "ยืนยันแล้ว",
  rejected: "ปฏิเสธ",
  expired: "หมดเวลา",
};
// สีพื้นช่อง "สถานะ" (ARGB)
const STATUS_FILL: Record<string, string> = {
  pending: "FFFEF3C7",
  awaiting_verify: "FFFEF3C7",
  confirmed: "FFD1FAE5",
  rejected: "FFFEE2E2",
  expired: "FFF5F5F4",
};
const SLIP_LABEL: Record<string, string> = {
  MATCH: "ตรงกับธนาคาร",
  AMOUNT_MISMATCH: "ยอดไม่ตรง",
  ACCOUNT_MISMATCH: "บัญชีผู้รับไม่ตรง",
  INVALID_SLIP: "สลิปไม่ถูกต้อง",
  DUPLICATE: "สลิปซ้ำ",
  ERROR: "ตรวจไม่สำเร็จ",
  SKIPPED: "-",
};

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7A1F2B" } };
const THIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFE7E5E4" } },
  bottom: { style: "thin", color: { argb: "FFE7E5E4" } },
  left: { style: "thin", color: { argb: "FFE7E5E4" } },
  right: { style: "thin", color: { argb: "FFE7E5E4" } },
};

/** เวลาไทยเป็น Date ที่ Excel แสดงตรงตามเวลาไทย (Excel ไม่มี timezone) */
function bangkok(d: Date) {
  return new Date(d.getTime() + 7 * 60 * 60 * 1000);
}

function setupSheet(ws: ExcelJS.Worksheet, title: string, columns: Partial<ExcelJS.Column>[]) {
  ws.columns = columns;
  // แถว 1 = ชื่อตาราง, แถว 2 = หัวคอลัมน์
  ws.insertRow(1, [title]);
  ws.mergeCells(1, 1, 1, columns.length);
  const t = ws.getCell(1, 1);
  t.font = { bold: true, size: 14 };
  t.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(1).height = 26;

  const h = ws.getRow(2);
  h.height = 22;
  h.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = HEADER_FILL;
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = THIN;
  });
  ws.views = [{ state: "frozen", ySplit: 2 }];
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: columns.length } };
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, printTitlesRow: "2:2" };
}

function styleBody(ws: ExcelJS.Worksheet, fromRow: number, toRow: number, zebra = true) {
  for (let r = fromRow; r <= toRow; r++) {
    const row = ws.getRow(r);
    row.eachCell({ includeEmpty: true }, (c) => {
      c.border = THIN;
      c.alignment = { vertical: "top", wrapText: true, ...(c.alignment || {}) };
      if (zebra && (r - fromRow) % 2 === 1 && !c.fill) {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAF9" } };
      }
    });
  }
}

export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF", "FINANCE_STAFF", "RESERVATION_STAFF"]);
  if (response) return response;

  const orders = await prisma.merchOrder.findMany({
    include: { items: true, slips: { orderBy: { uploadedAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const stamp = now.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
  const wb = new ExcelJS.Workbook();
  wb.created = now;

  // ================= ชีต 1: คำสั่งซื้อ (1 แถว / ออเดอร์) =================
  const ws = wb.addWorksheet("คำสั่งซื้อ");
  setupSheet(ws, `คำสั่งซื้อของที่ระลึก — งานคืนสู่เหย้า (ส่งออกเมื่อ ${stamp})`, [
    { header: "ลำดับ", key: "no", width: 6 },
    { header: "รหัสคำสั่งซื้อ", key: "orderCode", width: 13 },
    { header: "วันที่สั่งซื้อ", key: "createdAt", width: 17 },
    { header: "ชื่อผู้สั่ง", key: "bookerName", width: 22 },
    { header: "เบอร์โทรศัพท์", key: "bookerPhone", width: 13 },
    { header: "รายการสินค้า", key: "items", width: 34 },
    { header: "จำนวนชิ้น", key: "qty", width: 9 },
    { header: "ค่าสินค้า", key: "subtotal", width: 11 },
    { header: "ค่าจัดส่ง", key: "shippingFee", width: 10 },
    { header: "ยอดรวม (บาท)", key: "totalAmount", width: 12 },
    { header: "สถานะ", key: "status", width: 15 },
    { header: "ผลตรวจสลิป", key: "slip", width: 15 },
    { header: "เลขพัสดุ", key: "tracking", width: 16 },
    { header: "วันที่จัดส่ง", key: "shippedAt", width: 15 },
  ]);

  orders.forEach((o, i) => {
    const qty = o.items.reduce((n, it) => n + it.quantity, 0);
    const subtotal = o.items.reduce((n, it) => n + it.quantity * Number(it.unitPrice), 0);
    const slip = o.slips[0];
    const row = ws.addRow({
      no: i + 1,
      orderCode: o.orderCode,
      createdAt: bangkok(o.createdAt),
      bookerName: o.bookerName,
      bookerPhone: o.bookerPhone,
      items: o.items.map((it) => `• ${it.productName}${it.size ? ` (${it.size})` : ""} × ${it.quantity}`).join("\n"),
      qty,
      subtotal,
      shippingFee: Number(o.shippingFee),
      totalAmount: Number(o.totalAmount),
      status: STATUS_LABEL[o.paymentStatus] || o.paymentStatus,
      slip: slip?.easyslipStatus ? SLIP_LABEL[slip.easyslipStatus] || slip.easyslipStatus : "-",
      tracking: o.trackingNumber || "",
      shippedAt: o.shippedAt ? bangkok(o.shippedAt) : "",
    });
    row.getCell("status").fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS_FILL[o.paymentStatus] || "FFFFFFFF" } };
    if (slip?.easyslipStatus && slip.easyslipStatus !== "MATCH" && slip.easyslipStatus !== "SKIPPED") {
      row.getCell("slip").font = { color: { argb: "FFB91C1C" } };
    }
  });
  const lastOrderRow = ws.rowCount;
  styleBody(ws, 3, lastOrderRow);
  ws.getColumn("createdAt").numFmt = "d/m/yyyy hh:mm";
  ws.getColumn("shippedAt").numFmt = "d/m/yyyy";
  for (const k of ["subtotal", "shippingFee", "totalAmount"]) ws.getColumn(k).numFmt = "#,##0";
  for (const k of ["no", "qty", "status", "slip", "orderCode"]) {
    ws.getColumn(k).eachCell((c, r) => {
      if (r > 2) c.alignment = { ...(c.alignment || {}), horizontal: "center" };
    });
  }
  ws.getColumn("bookerPhone").eachCell((c, r) => {
    if (r > 2) {
      c.numFmt = "@";
      c.alignment = { ...(c.alignment || {}), horizontal: "center" };
    }
  });

  // ---- สรุปท้ายตาราง แยกตามสถานะ ----
  ws.addRow([]);
  const sumHead = ws.addRow(["", "สรุปตามสถานะ", "", "", "", "", "จำนวนชิ้น", "", "", "ยอดเงิน (บาท)", "จำนวนออเดอร์"]);
  sumHead.font = { bold: true };
  for (const st of ["confirmed", "awaiting_verify", "pending", "rejected", "expired"]) {
    const list = orders.filter((o) => o.paymentStatus === st);
    if (!list.length) continue;
    const r = ws.addRow([
      "",
      STATUS_LABEL[st],
      "", "", "", "",
      list.reduce((n, o) => n + o.items.reduce((m, it) => m + it.quantity, 0), 0),
      "", "",
      list.reduce((n, o) => n + Number(o.totalAmount), 0),
      list.length,
    ]);
    r.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS_FILL[st] } };
    r.getCell(10).numFmt = "#,##0";
  }
  const tot = ws.addRow(["", "รวมทั้งหมด", "", "", "", "", orders.reduce((n, o) => n + o.items.reduce((m, it) => m + it.quantity, 0), 0), "", "", orders.reduce((n, o) => n + Number(o.totalAmount), 0), orders.length]);
  tot.font = { bold: true };
  tot.getCell(10).numFmt = "#,##0";
  tot.getCell(2).border = { top: { style: "thin" } };

  // ================= ชีต 2: รายการสินค้า (1 แถว / สินค้า) — ใช้กรอง/นับ/Pivot ได้ =================
  const wi = wb.addWorksheet("รายการสินค้า");
  setupSheet(wi, `รายการสินค้าในคำสั่งซื้อ (1 แถวต่อสินค้า — ใช้กรอง/นับ/Pivot) ส่งออกเมื่อ ${stamp}`, [
    { header: "รหัสคำสั่งซื้อ", key: "orderCode", width: 13 },
    { header: "วันที่สั่งซื้อ", key: "createdAt", width: 17 },
    { header: "ชื่อผู้สั่ง", key: "bookerName", width: 22 },
    { header: "สินค้า", key: "product", width: 28 },
    { header: "ไซซ์", key: "size", width: 7 },
    { header: "จำนวน", key: "qty", width: 8 },
    { header: "ราคา/ชิ้น", key: "unitPrice", width: 10 },
    { header: "รวม (บาท)", key: "lineTotal", width: 11 },
    { header: "สถานะ", key: "status", width: 15 },
  ]);
  for (const o of orders) {
    for (const it of o.items) {
      const r = wi.addRow({
        orderCode: o.orderCode,
        createdAt: bangkok(o.createdAt),
        bookerName: o.bookerName,
        product: it.productName,
        size: it.size || "-",
        qty: it.quantity,
        unitPrice: Number(it.unitPrice),
        lineTotal: it.quantity * Number(it.unitPrice),
        status: STATUS_LABEL[o.paymentStatus] || o.paymentStatus,
      });
      r.getCell("status").fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS_FILL[o.paymentStatus] || "FFFFFFFF" } };
    }
  }
  styleBody(wi, 3, wi.rowCount);
  wi.getColumn("createdAt").numFmt = "d/m/yyyy hh:mm";
  wi.getColumn("unitPrice").numFmt = "#,##0";
  wi.getColumn("lineTotal").numFmt = "#,##0";
  for (const k of ["size", "qty", "status", "orderCode"]) {
    wi.getColumn(k).eachCell((c, r) => {
      if (r > 2) c.alignment = { ...(c.alignment || {}), horizontal: "center" };
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `merch-orders-${now.toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buffer as any, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
