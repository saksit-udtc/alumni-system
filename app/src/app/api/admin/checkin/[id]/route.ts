import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";

// GET: lookup a reservation by id OR qrCodeToken for the check-in detail page.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req);
  if (response) return response;

  const reservation = await prisma.reservation.findFirst({
    where: { OR: [{ id: params.id }, { qrCodeToken: params.id }] },
    include: { event: { select: { name: true } }, table: { select: { tableNumber: true } } },
  });
  if (!reservation) return jsonError("ไม่พบการจองที่ระบุ", 404);

  return NextResponse.json({ reservation });
}

/**
 * Requirement #6: check-in only allowed if paymentStatus === 'confirmed'.
 * Protected solely by the admin JWT (via middleware) — the QR just links to
 * this admin-protected page keyed by qrCodeToken or reservation id.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req);
  if (response) return response;

  const reservation = await prisma.reservation.findFirst({
    where: { OR: [{ id: params.id }, { qrCodeToken: params.id }] },
  });
  if (!reservation) return jsonError("ไม่พบการจองที่ระบุ", 404);

  if (reservation.paymentStatus !== "confirmed") {
    return jsonError("เช็คอินได้เฉพาะการจองที่ยืนยันการชำระเงินแล้วเท่านั้น", 409);
  }
  if (reservation.checkedIn) {
    return jsonError("การจองนี้เช็คอินแล้ว", 409);
  }

  const updated = await prisma.reservation.update({
    where: { id: reservation.id },
    data: { checkedIn: true, checkedInAt: new Date(), checkedInBy: admin!.adminId },
  });

  return NextResponse.json({ reservation: updated });
}
