import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { releaseReservation, ReleaseError } from "@/lib/releaseReservation";

/**
 * Admin "reject slip" — uses the SAME shared release logic as the cron
 * expiry job (requirement #2), passing newStatus='rejected'.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req);
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const note = body?.note as string | undefined;

  try {
    await releaseReservation(params.id, "rejected");
  } catch (err) {
    if (err instanceof ReleaseError) {
      return jsonError(err.message, err.code === "NOT_FOUND" ? 404 : 409);
    }
    console.error("[POST /api/admin/reservations/[id]/reject]", err);
    return jsonError("เกิดข้อผิดพลาด", 500);
  }

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

  return NextResponse.json({ ok: true });
}
