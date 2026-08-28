import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { publicMerchProductUrl } from "@/lib/minio";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF"]);
  if (response) return response;

  const products = await prisma.merchProduct.findMany({
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
      active: p.active,
      imageUrl: p.imageKey ? publicMerchProductUrl(p.imageKey) : null,
      stock: Object.fromEntries(p.stocks.map((s) => [s.size ?? "", s.quantity])),
    })),
  });
}

export async function POST(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF"]);
  if (response) return response;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("invalid body");

  const { name, description, price, requiresSize } = body;
  if (!name?.trim() || price === undefined || price === null || Number(price) < 0) {
    return jsonError("กรุณากรอกชื่อสินค้าและราคาให้ถูกต้อง");
  }

  const product = await prisma.merchProduct.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      price: Number(price),
      requiresSize: !!requiresSize,
    },
  });

  return NextResponse.json({ product });
}
