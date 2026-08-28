import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF"]);
  if (response) return response;

  const existing = await prisma.merchProduct.findUnique({ where: { id: params.id } });
  if (!existing) return jsonError("ไม่พบสินค้าที่ระบุ", 404);

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("invalid body");

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (!String(body.name).trim()) return jsonError("กรุณากรอกชื่อสินค้า");
    data.name = String(body.name).trim();
  }
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.price !== undefined) {
    if (Number(body.price) < 0) return jsonError("ราคาต้องไม่ติดลบ");
    data.price = Number(body.price);
  }
  if (body.requiresSize !== undefined) data.requiresSize = !!body.requiresSize;
  if (body.active !== undefined) data.active = !!body.active;

  const product = await prisma.merchProduct.update({ where: { id: params.id }, data });
  return NextResponse.json({ product });
}

// Delete a product. Order history is preserved even after deletion —
// MerchOrderItem stores a productName snapshot taken at order time, and its
// productId is nullable (ON DELETE SET NULL), so past orders keep showing a
// real product name instead of breaking or disappearing.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF"]);
  if (response) return response;

  const existing = await prisma.merchProduct.findUnique({ where: { id: params.id } });
  if (!existing) return jsonError("ไม่พบสินค้าที่ระบุ", 404);

  await prisma.merchProduct.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
