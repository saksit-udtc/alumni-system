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
  const { response } = requireAdmin(req);
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

  await prisma.$transaction(
    entries.map(([sizeKey, qty]) => {
      const size = sizeKey === "" ? null : sizeKey;
      return prisma.merchProductStock.upsert({
        where: { productId_size: { productId: params.id, size } },
        update: { quantity: qty as number },
        create: { productId: params.id, size, quantity: qty as number },
      });
    })
  );

  const stocks = await prisma.merchProductStock.findMany({ where: { productId: params.id } });
  return NextResponse.json({
    stock: Object.fromEntries(stocks.map((s) => [s.size ?? "", s.quantity])),
  });
}
