import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";

export const dynamic = "force-dynamic";

/**
 * Set stock levels for a product. Body: { stock: { "": 12 } } for a
 * non-sized product, or { stock: { "S": 3, "M": 5, "L": 0 } } for a sized
 * one — same shape the public/admin GET endpoints return, so the admin UI
 * can round-trip it directly. Upserts one MerchProductStock row per key;
 * existing sizes not present in the body are left untouched (so partial
 * updates, e.g. from the shop UI editing one size at a time, are safe).
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF"]);
  if (response) return response;

  const product = await prisma.merchProduct.findUnique({ where: { id: params.id } });
  if (!product) return jsonError("ไม่พบสินค้าที่ระบุ", 404);

  const body = await req.json().catch(() => null);
  if (!body || typeof body.stock !== "object" || body.stock === null) {
    return jsonError("invalid body");
  }

  const entries = Object.entries(body.stock as Record<string, unknown>);
  for (const [, qty] of entries) {
    if (!Number.isInteger(qty) || (qty as number) < 0) {
      return jsonError("จำนวนสต๊อกต้องเป็นจำนวนเต็มไม่ติดลบ");
    }
  }

  // Not a plain upsert(): Prisma's compound-unique `where` (productId_size)
  // rejects a literal null for the nullable `size` half even though the
  // column itself is nullable ("Argument `size` must not be null") — so
  // non-sized products (size === null) go through a manual
  // findFirst-then-update/create instead, which supports null in an
  // ordinary filter just fine.
  await prisma.$transaction(async (tx) => {
    for (const [sizeKey, qty] of entries) {
      const size = sizeKey === "" ? null : sizeKey;
      const existing = await tx.merchProductStock.findFirst({
        where: { productId: params.id, size },
      });
      if (existing) {
        await tx.merchProductStock.update({
          where: { id: existing.id },
          data: { quantity: qty as number },
        });
      } else {
        await tx.merchProductStock.create({
          data: { productId: params.id, size, quantity: qty as number },
        });
      }
    }
  });

  const stocks = await prisma.merchProductStock.findMany({ where: { productId: params.id } });
  return NextResponse.json({
    stock: Object.fromEntries(stocks.map((s) => [s.size ?? "", s.quantity])),
  });
}
