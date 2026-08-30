import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { logAdminAction } from "@/lib/auditLog";

const HOLD_MINUTES = 20;

/**
 * Requirement #5: only from confirmed -> awaiting_verify, AND pushes
 * reservedUntil forward (+20min) in the same update so cron doesn't
 * immediately re-expire it. Does not touch seatsReserved.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN", "FINANCE_STAFF"]);
  if (response) return response;

  const reservation = await prisma.reservation.findUnique({ where: { id: params.id } });
  if (!reservation) return jsonError("ไม่พบการจองที่ระบุ", 404);

  if (reservation.paymentStatus !== "confirmed") {
    return jsonError("สามารถยกเลิกการยืนยันได้เฉพาะการจองที่ยืนยันแล้วเท่านั้น", 409);
  }

  const updated = await prisma.reservation.update({
    where: { id: params.id },
    data: {
      paymentStatus: "awaiting_verify",
      reservedUntil: new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
      checkedIn: false,
      checkedInAt: null,
      checkedInBy: null,
    },
  });

  await logAdminAction({
    adminId: admin!.adminId,
    action: "RESERVATION_UNCONFIRM",
    targetType: "Reservation",
    targetId: params.id,
  });

  return NextResponse.json({ reservation: updated });
}
