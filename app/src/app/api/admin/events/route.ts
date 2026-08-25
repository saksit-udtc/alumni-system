import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";

export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req);
  if (response) return response;

  const events = await prisma.event.findMany({
    orderBy: { eventDate: "desc" },
    include: { _count: { select: { tables: true, reservations: true } } },
  });
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const { response } = requireAdmin(req);
  if (response) return response;

  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.eventDate) return jsonError("กรุณากรอกชื่องานและวันที่จัดงาน");

  const event = await prisma.event.create({
    data: {
      name: body.name,
      eventDate: new Date(body.eventDate),
      location: body.location || null,
      seatsPerTable: body.seatsPerTable ?? 10,
      pricePerTable: body.pricePerTable ?? 0,
      pricePerSeat: body.pricePerSeat ?? 0,
      status: body.status || "draft",
    },
  });

  return NextResponse.json({ event });
}
