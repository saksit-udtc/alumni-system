import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiHelpers";

/** SUPER_ADMIN only, same reasoning as /api/admin/audit-log. */
export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // "SUCCESS" | "FAILED" | null (both)
  const take = Math.min(Number(searchParams.get("take")) || 50, 200);
  const cursor = searchParams.get("cursor");

  const logs = await prisma.emailLog.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  return NextResponse.json({
    logs,
    nextCursor: logs.length === take ? logs[logs.length - 1].id : null,
  });
}
