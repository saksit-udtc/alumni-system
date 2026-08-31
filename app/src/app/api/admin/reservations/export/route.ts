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

export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "FINANCE_STAFF", "RESERVATION_STAFF"]);
  if (response) return response;

  const reservations = await prisma.reservation.findMany({
    include: { table: { select: { tableNumber: true } }, event: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("รายการจอง");

  const columns = [
    { header: "รหัสการจอง", key: "bookingCode", width: 16 },
    { header: "งานเลี้ยง", key: "eventName", width: 20 },
    { header: "โต๊ะ", key: "tableNumber", width: 10 },
    { header: "ประเภท", key: "bookingType", width: 12 },
    { header: "จำนวนที่นั่ง", key: "seatCount", width: 12 },
    { header: "ชื่อผู้จอง", key: "bookerName", width: 24 },
    { header: "เบอร์โทรศัพท์", key: "bookerPhone", width: 16 },
    { header: "อีเมล", key: "bookerEmail", width: 24 },
    { header: "สถานะ", key: "status", width: 16 },
    { header: "ยอดชำระ (บาท)", key: "totalAmount", width: 14 },
    { header: "เช็คอิน", key: "checkedIn", width: 10 },
    { header: "รับของที่ระลึก", key: "souvenirGiven", width: 14 },
    { header: "วันที่จอง", key: "createdAt", width: 18 },
  ];
  sheet.columns = columns;

  for (const r of reservations) {
    const row = sheet.addRow({
      bookingCode: r.bookingCode,
      eventName: r.event.name,
      tableNumber: r.table.tableNumber,
      bookingType: r.bookingType === "full_table" ? "ทั้งโต๊ะ" : "รายที่นั่ง",
      seatCount: r.seatCount,
      bookerName: r.bookerName,
      bookerPhone: r.bookerPhone,
      bookerEmail: r.bookerEmail || "",
      status: STATUS_LABEL[r.paymentStatus] || r.paymentStatus,
      totalAmount: Number(r.totalAmount),
      checkedIn: r.checkedIn ? "ใช่" : "ไม่",
      souvenirGiven: r.souvenirGiven ? "ใช่" : "ไม่",
      createdAt: r.createdAt.toLocaleString("th-TH"),
    });
    row.alignment = { vertical: "top", wrapText: true };
  }

  const totalReservations = reservations.length;
  const confirmedReservations = reservations.filter((r) => r.paymentStatus === "confirmed");
  const confirmedCount = confirmedReservations.length;
  const confirmedRevenue = confirmedReservations.reduce((sum, r) => sum + Number(r.totalAmount), 0);
  const checkedInCount = reservations.filter((r) => r.checkedIn).length;

  sheet.addRow({});
  const totalRow = sheet.addRow({ bookingCode: "จำนวนการจองทั้งหมด", totalAmount: totalReservations });
  totalRow.font = { bold: true };
  const confirmedCountRow = sheet.addRow({ bookingCode: "จำนวนการจองที่ยืนยันแล้ว", totalAmount: confirmedCount });
  confirmedCountRow.font = { bold: true };
  const revenueRow = sheet.addRow({ bookingCode: "ยอดชำระที่ยืนยันแล้ว (บาท)", totalAmount: confirmedRevenue });
  revenueRow.font = { bold: true };
  const checkedInRow = sheet.addRow({ bookingCode: "จำนวนที่เช็คอินแล้ว", totalAmount: checkedInCount });
  checkedInRow.font = { bold: true };

  // Title row identifying the table, inserted above the header row that
  // `sheet.columns` already wrote to row 1 — pushes everything down by one.
  const lastColLetter = sheet.getColumn(columns.length).letter;
  sheet.insertRow(1, [`ตารางรายการจองโต๊ะ — งานคืนสู่เหย้า (ส่งออกเมื่อ ${new Date().toLocaleString("th-TH")})`]);
  sheet.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = sheet.getCell("A1");
  titleCell.font = { bold: true, size: 13 };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  sheet.getRow(2).font = { bold: true };
  sheet.getRow(2).alignment = { vertical: "middle", horizontal: "center" };

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `reservations-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
