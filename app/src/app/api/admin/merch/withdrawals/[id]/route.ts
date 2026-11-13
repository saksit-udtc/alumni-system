import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req, ["MERCH_STAFF"]);
  if (!admin) return response;
  const withdrawal = await prisma.merchWithdrawal.findUnique({
    where: { id: params.id },
    include: { items: true, createdBy: { select: { username: true } } },
  });
  if (!withdrawal) return jsonError("ไม่พบใบเบิก", 404);
  return NextResponse.json({ withdrawal });
}
