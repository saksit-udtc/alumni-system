import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiHelpers";

/** SUPER_ADMIN only — audit log covers every admin's actions and public traffic, so it's not scoped to a single role's own work. */
export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const actorType = searchParams.get("actorType"); // "ADMIN" | "PUBLIC" | null (both)
  const take = Math.min(Number(searchParams.get("take")) || 50, 200);
  const cursor = searchParams.get("cursor");

  const logs = await prisma.auditLog.findMany({
    where: actorType ? { actorType } : undefined,
    include: { admin: { select: { username: true } } },
    orderBy: { createdAt: "desc" },
    take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  return NextResponse.json({
    logs,
    nextCursor: logs.length === take ? logs[logs.length - 1].id : null,
  });
}
