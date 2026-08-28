import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiHelpers";

export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "CHECKIN_STAFF"]);
  if (response) return response;

  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (!q) return NextResponse.json({ reservations: [] });

  const reservations = await prisma.reservation.findMany({
    where: {
      OR: [
        { bookingCode: { contains: q, mode: "insensitive" } },
        { bookerName: { contains: q, mode: "insensitive" } },
        { bookerPhone: { contains: q } },
      ],
    },
    include: { event: { select: { name: true } }, table: { select: { tableNumber: true } } },
    take: 20,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ reservations });
}
