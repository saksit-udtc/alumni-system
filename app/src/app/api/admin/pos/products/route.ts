import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiHelpers";

// Plain GET, no dynamic route segment, reads the DB — must be forced
// dynamic or the Docker build tries to prerender it at build time, when
// DATABASE_URL doesn't exist yet (see project gotchas re: /api/events etc).
export const dynamic = "force-dynamic";

/**
 * Catalog feed for the POS terminal and the barcode-label admin UI: every
 * active product with its stock rows (id, size, quantity, barcode). The
 * POS page loads this once and matches scanned barcodes against it
 * client-side; the barcode-label page uses it to know which stock rows
 * still need a label generated/printed.
 */
export async function GET(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["MERCH_STAFF"]);
  if (!admin) return response;

  const products = await prisma.merchProduct.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    include: { stocks: { orderBy: { size: "asc" } } },
  });

  return NextResponse.json({
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      requiresSize: p.requiresSize,
      stocks: p.stocks.map((s) => ({
        id: s.id,
        size: s.size,
        quantity: s.quantity,
        barcode: s.barcode,
      })),
    })),
  });
}
