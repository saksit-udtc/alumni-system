import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicFloorPlanUrl } from "@/lib/minio";
import { getEventLayoutImageKey } from "@/lib/settings";
import { sweepExpiredThrottled } from "@/lib/releaseExpired";

// Public: event detail + tables + basic stats. No phone/email exposed.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // คืนโต๊ะที่กันไว้เกินเวลาก่อนอ่าน เพื่อให้ผังแสดงโต๊ะว่างล่าสุดเสมอ
  await sweepExpiredThrottled();
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

  // โต๊ะที่แอดมินล็อก (isLocked): หน้าเว็บแสดงสีเทา "ไม่เปิดจอง" แยกจากโต๊ะที่ถูกจอง กดจองไม่ได้
  // (ฝั่งเซิร์ฟเวอร์ตรวจซ้ำใน bookTable/bookPackage) และไม่นับรวมในสถิติจำนวนโต๊ะ/ที่นั่ง
  const publicTables = event.tables.map((t) => ({
    id: t.id,
    tableNumber: t.tableNumber,
    capacity: t.capacity,
    seatsReserved: t.seatsReserved,
    isFullTableBooking: t.isFullTableBooking,
    isLocked: t.isLocked,
    zone: t.zone,
    zoneColor: t.zoneColor,
    positionX: t.positionX,
    positionY: t.positionY,
    seatsAvailable: t.isLocked ? 0 : t.capacity - t.seatsReserved,
  }));

  const layoutKey = await getEventLayoutImageKey(event.id);

  const openTables = event.tables.filter((t) => !t.isLocked);
  const totalCapacity = openTables.reduce((s, t) => s + t.capacity, 0);
  const totalReserved = openTables.reduce((s, t) => s + t.seatsReserved, 0);

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
      layoutImageUrl: layoutKey ? publicFloorPlanUrl(layoutKey) : null,
    },
    tables: publicTables,
    stats: {
      totalCapacity,
      totalReserved,
      totalAvailable: totalCapacity - totalReserved,
      totalTables: openTables.length,
    },
  });
}
