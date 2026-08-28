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
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF"]);
  if (response) return response;

  const orders = await prisma.merchOrder.findMany({
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("คำสั่งซื้อของที่ระลึก");

  sheet.columns = [
    { header: "รหัสคำสั่งซื้อ", key: "orderCode", width: 16 },
    { header: "ชื่อผู้สั่ง", key: "bookerName", width: 24 },
    { header: "เบอร์โทรศัพท์", key: "bookerPhone", width: 16 },
    { header: "อีเมล", key: "bookerEmail", width: 24 },
    { header: "ที่อยู่จัดส่ง", key: "shippingAddress", width: 40 },
    { header: "รายการสินค้า", key: "items", width: 40 },
    { header: "ยอดรวม (บาท)", key: "totalAmount", width: 14 },
    { header: "สถานะ", key: "status", width: 16 },
    { header: "วันที่สั่งซื้อ", key: "createdAt", width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

  for (const o of orders) {
    const itemsText = o.items
      .map((it) => `${it.productName}${it.size ? ` (${it.size})` : ""} x${it.quantity}`)
      .join("\n");
    const row = sheet.addRow({
      orderCode: o.orderCode,
      bookerName: o.bookerName,
      bookerPhone: o.bookerPhone,
      bookerEmail: o.bookerEmail,
      shippingAddress: o.shippingAddress,
      items: itemsText,
      totalAmount: Number(o.totalAmount),
      status: STATUS_LABEL[o.paymentStatus] || o.paymentStatus,
      createdAt: o.createdAt.toLocaleString("th-TH"),
    });
    row.alignment = { vertical: "top", wrapText: true };
  }

  const totalOrders = orders.length;
  const confirmedOrders = orders.filter((o) => o.paymentStatus === "confirmed");
  const confirmedCount = confirmedOrders.length;
  const confirmedRevenue = confirmedOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

  sheet.addRow({});
  const totalRow = sheet.addRow({ orderCode: "จำนวนคำสั่งซื้อทั้งหมด", totalAmount: totalOrders });
  totalRow.font = { bold: true };
  const confirmedCountRow = sheet.addRow({ orderCode: "จำนวนคำสั่งซื้อที่ยืนยันแล้ว", totalAmount: confirmedCount });
  confirmedCountRow.font = { bold: true };
  const revenueRow = sheet.addRow({ orderCode: "ยอดขายที่ยืนยันแล้ว (บาท)", totalAmount: confirmedRevenue });
  revenueRow.font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `merch-orders-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
