import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicFloorPlanUrl } from "@/lib/minio";

// Public: event detail + tables + basic stats. No phone/email exposed.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: {
      tables: {
        orderBy: { tableNumber: "asc" },
      },
    },
  });

  if (!event || event.status === "draft") {
    return NextResponse.json({ error: "ไม่พบงานที่ระบุ" }, { status: 404 });
  }

  const publicTables = event.tables.map((t) => ({
    id: t.id,
    tableNumber: t.tableNumber,
    capacity: t.capacity,
    seatsReserved: t.seatsReserved,
    isFullTableBooking: t.isFullTableBooking,
    zone: t.zone,
    zoneColor: t.zoneColor,
    positionX: t.positionX,
    positionY: t.positionY,
    seatsAvailable: t.capacity - t.seatsReserved,
  }));

  const totalCapacity = event.tables.reduce((s, t) => s + t.capacity, 0);
  const totalReserved = event.tables.reduce((s, t) => s + t.seatsReserved, 0);

  return NextResponse.json({
    event: {
      id: event.id,
      name: event.name,
      eventDate: event.eventDate,
      location: event.location,
      seatsPerTable: event.seatsPerTable,
      pricePerTable: event.pricePerTable,
      pricePerSeat: event.pricePerSeat,
      status: event.status,
      floorPlanUrl: event.floorPlanUrl,
      floorPlanPublicUrl: event.floorPlanUrl ? publicFloorPlanUrl(event.floorPlanUrl) : null,
    },
    tables: publicTables,
    stats: {
      totalCapacity,
      totalReserved,
      totalAvailable: totalCapacity - totalReserved,
      totalTables: event.tables.length,
    },
  });
}
