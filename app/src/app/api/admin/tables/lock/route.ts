import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { logAdminAction } from "@/lib/auditLog";

/**
 * เปิด/ปิด "การล็อกโต๊ะ" — โต๊ะที่ล็อกจะไม่เปิดให้จอง (หน้าเว็บแสดงเป็นไม่ว่าง และ bookTable/bookPackage ปฏิเสธ)
 * ฟังก์ชันนี้ไม่สร้าง/แก้รายการจองใดๆ
 * body: { tableIds: string[], locked: boolean }
 * - ล็อก: ข้ามโต๊ะที่มีการจองอยู่แล้ว (seatsReserved > 0) เพื่อไม่ให้กระทบรายการจอง → คืนใน skipped
 * - ปลดล็อก: ปลดได้ทุกโต๊ะ
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN", "RESERVATION_STAFF"]);
  if (!admin) return response;

  const body = await req.json().catch(() => null);
  const tableIds: string[] = Array.isArray(body?.tableIds) ? body.tableIds.filter((x: unknown) => typeof x === "string") : [];
  if (tableIds.length === 0 || tableIds.length > 500) return jsonError("กรุณาเลือกโต๊ะ (1–500 โต๊ะ)");
  if (typeof body?.locked !== "boolean") return jsonError("invalid body");
  const locked: boolean = body.locked;

  const tables = await prisma.table.findMany({
    where: { id: { in: tableIds } },
    select: { id: true, tableNumber: true, seatsReserved: true, isFullTableBooking: true, isLocked: true },
  });

  const eligible = tables.filter((t) => t.isLocked !== locked && (!locked || (t.seatsReserved === 0 && !t.isFullTableBooking)));
  const skipped = locked ? tables.filter((t) => !t.isLocked && (t.seatsReserved > 0 || t.isFullTableBooking)).map((t) => t.tableNumber) : [];

  if (eligible.length > 0) {
    await prisma.table.updateMany({
      where: { id: { in: eligible.map((t) => t.id) } },
      data: { isLocked: locked },
    });
    await logAdminAction({
      adminId: admin.adminId,
      action: locked ? "TABLE_LOCK" : "TABLE_UNLOCK",
      targetType: "Table",
      detail: `${locked ? "ล็อก" : "ปลดล็อก"}โต๊ะ ${eligible.map((t) => t.tableNumber).sort((a, b) => a - b).join(", ")}`,
    });
  }

  return NextResponse.json({ ok: true, changed: eligible.length, skipped });
}
