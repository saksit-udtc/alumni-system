import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";

/**
 * Bulk-updates drag-drop positions from the floor-plan editor.
 * body: { positions: [{ tableId, positionX, positionY }, ...] }
 * Requirement #11: verifies every tableId actually belongs to this event
 * before writing anything (anti-IDOR).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "FINANCE_STAFF"]);
  if (response) return response;

  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.positions)) return jsonError("invalid body");

  const tableIds: string[] = body.positions.map((p: any) => p.tableId);
  const tables = await prisma.table.findMany({
    where: { id: { in: tableIds } },
    select: { id: true, eventId: true },
  });

  const validIds = new Set(tables.filter((t) => t.eventId === params.id).map((t) => t.id));
  if (validIds.size !== tableIds.length) {
    return jsonError("มีโต๊ะบางรายการไม่ได้อยู่ในงานนี้", 400);
  }

  await prisma.$transaction(
    body.positions.map((p: any) =>
      prisma.table.update({
        where: { id: p.tableId },
        data: {
          positionX: Math.max(0, Math.min(100, Number(p.positionX))),
          positionY: Math.max(0, Math.min(100, Number(p.positionY))),
        },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
