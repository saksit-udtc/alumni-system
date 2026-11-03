import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { bookTable, BookingError } from "@/lib/bookTable";
import { prisma } from "@/lib/prisma";
import { sendBookingReceivedEmail } from "@/lib/mailer";
import { logAdminAction } from "@/lib/auditLog";
import { MAX_TABLE_LONG_HOLD_DAYS, getTableLongHoldDays } from "@/lib/settings";

/**
 * แอดมินล็อกโต๊ะให้ผู้จองรอชำระเงินหลายวัน (เฉพาะโต๊ะ — ของที่ระลึกยังกัน 30 นาที)
 * ผู้จองทั่วไปทำเองไม่ได้: ฟังก์ชันนี้อยู่หลัง requireAdmin(SUPER_ADMIN) เท่านั้น
 * ผลลัพธ์เหมือนการจองปกติที่ยังไม่แนบสลิป (pending) แต่ reservedUntil = อีก N วัน
 * ผู้จองรับอีเมลพร้อมลิงก์หน้าชำระเงิน/แนบสลิป; ครบกำหนดแล้วไม่จ่ายตัวเช็คหมดเวลาปล่อยโต๊ะเอง
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (!admin) return response;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("invalid body");

  const eventId = String(body.eventId || "");
  const tableId = String(body.tableId || "");
  const bookerName = String(body.bookerName || "");
  const bookerPhone = String(body.bookerPhone || "");
  const bookerEmail = String(body.bookerEmail || "");
  if (!eventId || !tableId) return jsonError("กรุณาเลือกงานและโต๊ะ");

  const days = body.days === undefined || body.days === "" ? await getTableLongHoldDays() : Number(body.days);
  if (!Number.isInteger(days) || days < 1 || days > MAX_TABLE_LONG_HOLD_DAYS) {
    return jsonError(`จำนวนวันต้องเป็นจำนวนเต็ม 1–${MAX_TABLE_LONG_HOLD_DAYS}`);
  }

  const table = await prisma.table.findUnique({ where: { id: tableId } });
  if (!table || table.eventId !== eventId) return jsonError("ไม่พบโต๊ะที่ระบุ", 404);

  try {
    const reservation = await bookTable({
      eventId,
      tableId,
      bookingType: "full_table",
      seatCount: table.capacity,
      bookerName,
      bookerPhone,
      bookerEmail,
      adminHoldDays: days,
    });

    await logAdminAction({
      adminId: admin.adminId,
      action: "RESERVATION_ADMIN_LOCK",
      targetType: "Reservation",
      targetId: reservation.id,
      detail: `ล็อกโต๊ะ ${table.tableNumber} ให้ ${reservation.bookerName} (${reservation.bookingCode}) ${days} วัน`,
    });

    // อีเมลแจ้งผู้จอง (fail-soft ไม่บล็อกการตอบกลับ)
    if (reservation.bookerEmail) {
      void (async () => {
        const event = await prisma.event.findUnique({ where: { id: reservation.eventId } });
        if (!event) return;
        await sendBookingReceivedEmail({
          to: reservation.bookerEmail!,
          bookerName: reservation.bookerName,
          bookerPhone: reservation.bookerPhone,
          eventName: event.name,
          tableNumber: table.tableNumber,
          zone: table.zone ?? null,
          bookingType: reservation.bookingType,
          seatCount: reservation.seatCount,
          totalAmount: Number(reservation.totalAmount),
          bookingCode: reservation.bookingCode,
          awaitingSlip: true,
          longHold: true,
          holdUntil: reservation.reservedUntil,
        });
      })().catch((err) => console.error("[POST /api/admin/reservations/lock] email failed:", err));
    }

    return NextResponse.json({
      ok: true,
      bookingCode: reservation.bookingCode,
      reservationId: reservation.id,
      reservedUntil: reservation.reservedUntil,
      totalAmount: reservation.totalAmount,
    });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message, code: err.code }, { status: 409 });
    console.error("[POST /api/admin/reservations/lock]", err);
    return jsonError("ล็อกโต๊ะไม่สำเร็จ กรุณาลองใหม่", 500);
  }
}
