import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { logAdminAction } from "@/lib/auditLog";
import { sendConfirmationEmail } from "@/lib/mailer";

/**
 * Requirement #4: approve slip -> confirmed, records verifiedBy/verifiedAt
 * on the latest PaymentSlip row, then attempts to email the QR code.
 * Email failure is caught inside sendConfirmationEmail and must never fail
 * this endpoint.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const reservation = await prisma.reservation.findUnique({
    where: { id: params.id },
    include: { event: true, table: true, slips: { orderBy: { uploadedAt: "desc" }, take: 1 } },
  });
  if (!reservation) return jsonError("ไม่พบการจองที่ระบุ", 404);

  if (reservation.paymentStatus !== "awaiting_verify" && reservation.paymentStatus !== "pending") {
    return jsonError("สถานะการจองไม่สามารถอนุมัติได้", 409);
  }

  const latestSlip = reservation.slips[0];
  const note = (await req.json().catch(() => null))?.note as string | undefined;

  // The status check above reads outside the transaction, so two concurrent
  // approve requests (two admins, or a double-click) could both pass it
  // before either writes. Using updateMany with the same status condition
  // as part of the actual write makes the transition atomic: only the
  // request that finds the row still in an approvable state actually
  // updates it, and `count` tells us which one that was. Anyone racing
  // behind gets a clean 409 instead of double-approving / double-emailing.
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.reservation.updateMany({
      where: { id: reservation.id, paymentStatus: { in: ["awaiting_verify", "pending"] } },
      data: { paymentStatus: "confirmed" },
    });
    if (result.count === 0) return false;

    if (latestSlip) {
      await tx.paymentSlip.update({
        where: { id: latestSlip.id },
        data: { verifiedBy: admin!.adminId, verifiedAt: new Date(), note: note || null },
      });
    }
    return true;
  });

  if (!updated) {
    return jsonError("สถานะการจองไม่สามารถอนุมัติได้ (มีการอนุมัติไปแล้ว)", 409);
  }

  await logAdminAction({
    adminId: admin!.adminId,
    action: "RESERVATION_APPROVE",
    targetType: "Reservation",
    targetId: reservation.id,
    detail: `bookingCode=${reservation.bookingCode}`,
  });

  if (reservation.bookerEmail && reservation.qrCodeToken) {
    await sendConfirmationEmail({
      to: reservation.bookerEmail,
      bookerName: reservation.bookerName,
      eventName: reservation.event.name,
      tableNumber: reservation.table.tableNumber,
      bookingCode: reservation.bookingCode,
      qrCodeToken: reservation.qrCodeToken,
    });
  }

  return NextResponse.json({ ok: true });
}
