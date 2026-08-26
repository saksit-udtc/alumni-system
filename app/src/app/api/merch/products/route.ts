import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicMerchProductUrl } from "@/lib/minio";
export const dynamic = "force-dynamic";

// Public: list active merch products for the shop page.
export async function GET() {
  const products = await prisma.merchProduct.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      requiresSize: p.requiresSize,
      imageUrl: p.imageKey ? publicMerchProductUrl(p.imageKey) : null,
    })),
  });
}
