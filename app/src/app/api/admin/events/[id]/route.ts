import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { publicFloorPlanUrl } from "@/lib/minio";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req);
  if (response) return response;

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: { tables: { orderBy: { tableNumber: "asc" } } },
  });
  if (!event) return jsonError("ไม่พบงานที่ระบุ", 404);

  const [confirmed, awaiting, pending, revenueAgg] = await Promise.all([
    prisma.reservation.count({ where: { eventId: params.id, paymentStatus: "confirmed" } }),
    prisma.reservation.count({ where: { eventId: params.id, paymentStatus: "awaiting_verify" } }),
    prisma.reservation.count({ where: { eventId: params.id, paymentStatus: "pending" } }),
    prisma.reservation.aggregate({
      where: { eventId: params.id, paymentStatus: "confirmed" },
      _sum: { totalAmount: true },
    }),
  ]);

  return NextResponse.json({
    event: {
      ...event,
      floorPlanPublicUrl: event.floorPlanUrl ? publicFloorPlanUrl(event.floorPlanUrl) : null,
    },
    stats: {
      confirmedCount: confirmed,
      awaitingVerifyCount: awaiting,
      // "รอตรวจสอบ/รอชำระ" combines both pre-confirmation statuses, matching
      // the old app's pendingCount (pending + awaiting_verify).
      pendingCount: pending + awaiting,
      totalRevenue: revenueAgg._sum.totalAmount || 0,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req);
  if (response) return response;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("invalid body");

  const existing = await prisma.event.findUnique({ where: { id: params.id } });
  if (!existing) return jsonError("ไม่พบงานที่ระบุ", 404);

  const event = await prisma.event.update({
    where: { id: params.id },
    data: {
      name: body.name ?? existing.name,
      eventDate: body.eventDate ? new Date(body.eventDate) : existing.eventDate,
      location: body.location ?? existing.location,
      seatsPerTable: body.seatsPerTable ?? existing.seatsPerTable,
      pricePerTable: body.pricePerTable ?? existing.pricePerTable,
      pricePerSeat: body.pricePerSeat ?? existing.pricePerSeat,
      status: body.status ?? existing.status,
    },
  });

  return NextResponse.json({ event });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req);
  if (response) return response;

  const existing = await prisma.event.findUnique({ where: { id: params.id } });
  if (!existing) return jsonError("ไม่พบงานที่ระบุ", 404);

  await prisma.event.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
