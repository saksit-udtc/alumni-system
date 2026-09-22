import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { logAdminAction } from "@/lib/auditLog";
import { releaseReservation, ReleaseError } from "@/lib/releaseReservation";
import { sendReservationRejectedEmail } from "@/lib/mailer";

/**
 * Admin "reject slip" — uses the SAME shared release logic as the cron
 * expiry job (requirement #2), passing newStatus='rejected'.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN", "FINANCE_STAFF", "RESERVATION_STAFF"]);
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const note = body?.note as string | undefined;

  // Snapshot before release, so we know whether this call actually flipped
  // pending/awaiting_verify -> rejected (vs. a no-op re-click on an already
  // rejected/expired reservation) and have the fields the rejection email
  // needs — releaseReservation's own raw-SQL update doesn't return them.
  const before = await prisma.reservation.findUnique({
    where: { id: params.id },
    include: { event: { select: { name: true } } },
  });

  try {
    await releaseReservation(params.id, "rejected");
  } catch (err) {
    if (err instanceof ReleaseError) {
      return jsonError(err.message, err.code === "NOT_FOUND" ? 404 : 409);
    }
    console.error("[POST /api/admin/reservations/[id]/reject]", err);
    return jsonError("เกิดข้อผิดพลาด", 500);
  }

  await logAdminAction({
    adminId: admin!.adminId,
    action: "RESERVATION_REJECT",
    targetType: "Reservation",
    targetId: params.id,
    detail: note ? `note=${note}` : undefined,
  });

  if (note) {
    const latestSlip = await prisma.paymentSlip.findFirst({
      where: { reservationId: params.id },
      orderBy: { uploadedAt: "desc" },
    });
    if (latestSlip) {
      await prisma.paymentSlip.update({
        where: { id: latestSlip.id },
        data: { verifiedBy: admin!.adminId, verifiedAt: new Date(), note },
      });
    }
  }

  // แจ้งลูกค้าทางอีเมล (fail-soft, ไม่บล็อกการปฏิเสธ) — ส่งเฉพาะตอนที่เพิ่งเปลี่ยน
  // สถานะเป็น rejected จริง ๆ รอบนี้ กันอีเมลซ้ำถ้ากดปฏิเสธซ้ำ/กดสองแท็บพร้อมกัน
  if (before && before.bookerEmail && ["pending", "awaiting_verify"].includes(before.paymentStatus)) {
    await sendReservationRejectedEmail({
      to: before.bookerEmail,
      bookerName: before.bookerName,
      eventName: before.event.name,
      bookingCode: before.bookingCode,
      note,
    });
  }

  return NextResponse.json({ ok: true });
}
