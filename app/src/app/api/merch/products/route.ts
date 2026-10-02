import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicMerchProductUrl } from "@/lib/minio";
import { getMerchShippingFee } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Public: list active merch products for the shop page, with remaining
// stock so the UI can disable out-of-stock sizes/products instead of
// letting the guest hit an OUT_OF_STOCK error at checkout. Also returns the
// current shipping fee so the shop page can show it in the order total
// before checkout, alongside the per-item prices.
export async function GET() {
  const [products, shippingFee] = await Promise.all([
    prisma.merchProduct.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { stocks: true, images: { orderBy: { sortOrder: "asc" } } },
    }),
    getMerchShippingFee(),
  ]);

  // ลำดับแสดงหน้าร้าน (ซ้าย→ขวา): เสื้อคอปก, เสื้อคอกลม, แก้วน้ำ, เหรียญ แล้วตามด้วยสินค้าอื่น
  // (sort เสถียร — สินค้าอื่นคงลำดับ sortOrder/createdAt เดิม)
  const rank = (name: string) => {
    const keys = ["คอปก", "คอกลม", "แก้ว", "เหรียญ"];
    const i = keys.findIndex((k) => name.includes(k));
    return i === -1 ? keys.length : i;
  };
  products.sort((a, b) => rank(a.name) - rank(b.name));

  return NextResponse.json({
    shippingFee,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      requiresSize: p.requiresSize,
      imageUrl: p.imageKey ? publicMerchProductUrl(p.imageKey) : null,
      // Full gallery for the detail view: cover image first, then extras in
      // admin-defined order. imageUrl above stays the cover for the grid.
      images: [
        ...(p.imageKey ? [publicMerchProductUrl(p.imageKey)] : []),
        ...p.images.map((img) => publicMerchProductUrl(img.imageKey)),
      ],
      // Back-side photo — with imageUrl as the front, the detail view shows a
      // ด้านหน้า/ด้านหลัง toggle instead of the gallery above.
      backImageUrl: p.backImageKey ? publicMerchProductUrl(p.backImageKey) : null,
      sizeGuideUrl: p.sizeGuideKey ? publicMerchProductUrl(p.sizeGuideKey) : null,
      // requiresSize: false -> { "": <qty> }. requiresSize: true -> one
      // entry per size, e.g. { "M": 3, "L": 0 }. A size/slot with no stock
      // row at all is treated as 0 (out of stock), never as unlimited.
      stock: Object.fromEntries(p.stocks.map((s) => [s.size ?? "", s.quantity])),
    })),
  });
}
