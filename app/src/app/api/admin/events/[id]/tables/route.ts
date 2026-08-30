import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "FINANCE_STAFF", "RESERVATION_STAFF"]);
  if (response) return response;

  const tables = await prisma.table.findMany({
    where: { eventId: params.id },
    orderBy: { tableNumber: "asc" },
  });
  return NextResponse.json({ tables });
}

// Bulk-add tables, e.g. { count: 20, capacity: 10, zone: "A", zoneColor: "#f97316" }
// or explicit { tables: [{tableNumber, capacity, zone, zoneColor}, ...] }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "FINANCE_STAFF", "RESERVATION_STAFF"]);
  if (response) return response;

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return jsonError("ไม่พบงานที่ระบุ", 404);

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("invalid body");

  const existingMax = await prisma.table.aggregate({
    where: { eventId: params.id },
    _max: { tableNumber: true },
  });
  let nextNumber = (existingMax._max.tableNumber || 0) + 1;

  let dataToCreate: Array<{ tableNumber: number; capacity: number; zone?: string; zoneColor?: string }> = [];

  if (Array.isArray(body.tables)) {
    dataToCreate = body.tables;
  } else if (body.count) {
    const capacity = body.capacity || event.seatsPerTable;
    for (let i = 0; i < Number(body.count); i++) {
      dataToCreate.push({
        tableNumber: nextNumber++,
        capacity,
        zone: body.zone,
        zoneColor: body.zoneColor,
      });
    }
  } else {
    return jsonError("กรุณาระบุจำนวนโต๊ะหรือรายการโต๊ะ");
  }

  const created = await prisma.$transaction(
    dataToCreate.map((t) =>
      prisma.table.create({
        data: {
          eventId: params.id,
          tableNumber: t.tableNumber,
          capacity: t.capacity,
          zone: t.zone || null,
          zoneColor: t.zoneColor || null,
        },
      })
    )
  );

  return NextResponse.json({ tables: created });
}
