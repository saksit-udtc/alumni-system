import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";

/**
 * Requirement #7: souvenir claim toggle, independent from check-in,
 * only allowed for confirmed reservations.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req);
  if (response) return response;

  const reservation = await prisma.reservation.findUnique({ where: { id: params.id } });
  if (!reservation) return jsonError("ไม่พบการจองที่ระบุ", 404);

  if (reservation.paymentStatus !== "confirmed") {
    return jsonError("มอบของที่ระลึกได้เฉพาะการจองที่ยืนยันการชำระเงินแล้วเท่านั้น", 409);
  }

  const newValue = !reservation.souvenirGiven;
  const updated = await prisma.reservation.update({
    where: { id: params.id },
    data: {
      souvenirGiven: newValue,
      souvenirGivenAt: newValue ? new Date() : null,
      souvenirGivenBy: newValue ? admin!.adminId : null,
    },
  });

  return NextResponse.json({ reservation: updated });
}
