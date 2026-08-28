import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";

async function loadTableForEvent(eventId: string, tableId: string) {
  const table = await prisma.table.findUnique({ where: { id: tableId } });
  // Requirement #11: anti-IDOR — the table must belong to the given event.
  if (!table || table.eventId !== eventId) return null;
  return table;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; tableId: string } }
) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const table = await loadTableForEvent(params.id, params.tableId);
  if (!table) return jsonError("ไม่พบโต๊ะในงานนี้", 404);

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("invalid body");

  // Guard against shrinking capacity below seats already reserved on this
  // table — otherwise seatsReserved > capacity persists, showing a negative
  // "seats remaining" and leaving the table stuck (every future booking
  // fails the seatsReserved + seatCount > capacity check) with no obvious
  // cause from the admin UI.
  if (body.capacity !== undefined && Number(body.capacity) < table.seatsReserved) {
    return jsonError(
      `ไม่สามารถลดความจุต่ำกว่าจำนวนที่นั่งที่จองแล้ว (${table.seatsReserved} ที่นั่ง)`,
      409
    );
  }

  const updated = await prisma.table.update({
    where: { id: table.id },
    data: {
      capacity: body.capacity ?? table.capacity,
      zone: body.zone ?? table.zone,
      zoneColor: body.zoneColor ?? table.zoneColor,
      positionX: body.positionX ?? table.positionX,
      positionY: body.positionY ?? table.positionY,
    },
  });

  return NextResponse.json({ table: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; tableId: string } }
) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const table = await loadTableForEvent(params.id, params.tableId);
  if (!table) return jsonError("ไม่พบโต๊ะในงานนี้", 404);

  if (table.seatsReserved > 0) {
    return jsonError("ไม่สามารถลบโต๊ะที่มีการจองอยู่ได้", 409);
  }

  await prisma.table.delete({ where: { id: table.id } });
  return NextResponse.json({ ok: true });
}
