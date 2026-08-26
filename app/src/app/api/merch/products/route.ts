import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicMerchProductUrl } from "@/lib/minio";

export const dynamic = "force-dynamic";

// Public: list active merch products for the shop page, with remaining
// stock so the UI can disable out-of-stock sizes/products instead of
// letting the guest hit an OUT_OF_STOCK error at checkout.
export async function GET() {
  const products = await prisma.merchProduct.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    include: { stocks: true },
  });

  return NextResponse.json({
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      requiresSize: p.requiresSize,
      imageUrl: p.imageKey ? publicMerchProductUrl(p.imageKey) : null,
      // requiresSize: false -> { "": <qty> }. requiresSize: true -> one
      // entry per size, e.g. { "M": 3, "L": 0 }. A size/slot with no stock
      // row at all is treated as 0 (out of stock), never as unlimited.
      stock: Object.fromEntries(p.stocks.map((s) => [s.size ?? "", s.quantity])),
    })),
  });
}
