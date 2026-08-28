import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";

/**
 * Admin-only edit of an order's shipping address (e.g. fixing a typo the
 * booker made before it ships). Only shippingAddress is editable here —
 * no other field on the order should be patchable through this route.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const shippingAddress = typeof body?.shippingAddress === "string" ? body.shippingAddress.trim() : "";
  if (!shippingAddress) {
    return jsonError("กรุณาระบุที่อยู่จัดส่ง", 400);
  }

  const order = await prisma.merchOrder.findUnique({ where: { id: params.id } });
  if (!order) return jsonError("ไม่พบการสั่งซื้อที่ระบุ", 404);

  await prisma.merchOrder.update({
    where: { id: params.id },
    data: { shippingAddress },
  });

  return NextResponse.json({ ok: true });
}
