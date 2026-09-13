import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";

// One package-sale reservation, for the POS confirmation/receipt page.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF", "RESERVATION_STAFF"]);
  if (!admin) return response;

  const reservation = await prisma.reservation.findUnique({
    where: { id: params.id },
    include: {
      event: { select: { id: true, name: true, eventDate: true, location: true } },
      table: { select: { id: true, tableNumber: true, zone: true } },
      package: { select: { id: true, name: true } },
      packageItems: true,
      cashierUser: { select: { id: true, username: true } },
    },
  });
  if (!reservation || !reservation.packageId) {
    return jsonError("ไม่พบรายการขายแพ็กเกจที่ระบุ", 404);
  }

  return NextResponse.json({ reservation });
}
