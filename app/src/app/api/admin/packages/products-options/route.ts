import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiHelpers";

// Self-contained option list for the package admin UI's item picker (active
// products + their stock variants) — its own tiny endpoint for the same
// reason as ../events-options/route.ts.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF", "RESERVATION_STAFF"]);
  if (!admin) return response;

  const products = await prisma.merchProduct.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      requiresSize: true,
      stocks: { select: { id: true, size: true, quantity: true } },
    },
  });

  return NextResponse.json({ products });
}
