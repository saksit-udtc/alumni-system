import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiHelpers";

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req);
  if (response) return response;

  const reservations = await prisma.reservation.findMany({
    where: { eventId: params.id },
    include: { table: { select: { tableNumber: true } } },
    orderBy: { createdAt: "asc" },
  });

  const header = [
    "รหัสการจอง",
    "โต๊ะ",
    "ประเภท",
    "จำนวนที่นั่ง",
    "ชื่อผู้จอง",
    "เบอร์โทร",
    "อีเมล",
    "สถานะ",
    "ยอดชำระ",
    "เช็คอิน",
    "รับของที่ระลึก",
    "วันที่จอง",
  ];

  const rows = reservations.map((r) => [
    r.bookingCode,
    r.table.tableNumber,
    r.bookingType === "full_table" ? "ทั้งโต๊ะ" : "รายที่นั่ง",
    r.seatCount,
    r.bookerName,
    r.bookerPhone,
    r.bookerEmail || "",
    r.paymentStatus,
    r.totalAmount.toString(),
    r.checkedIn ? "ใช่" : "ไม่",
    r.souvenirGiven ? "ใช่" : "ไม่",
    r.createdAt.toISOString(),
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  const bom = "﻿"; // for Thai characters to render correctly in Excel

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reservations-${params.id}.csv"`,
    },
  });
}
