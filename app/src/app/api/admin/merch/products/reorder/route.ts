import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";

// Save a new display order for the shop: body { ids: [productId, ...] } in the
// desired order. Products get sortOrder 1..n in that sequence.
export async function POST(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF"]);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const ids: unknown = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== "string")) {
    return jsonError("invalid body");
  }

  await prisma.$transaction(
    (ids as string[]).map((id, i) =>
      prisma.merchProduct.updateMany({ where: { id }, data: { sortOrder: i + 1 } })
    )
  );

  return NextResponse.json({ ok: true });
}
