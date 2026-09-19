import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { deleteObject, MERCH_PRODUCTS_BUCKET } from "@/lib/minio";

export async function DELETE(req: NextRequest, { params }: { params: { id: string; imageId: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF"]);
  if (response) return response;

  // Scope by productId too so an image id from another product can't be
  // deleted through this product's URL.
  const image = await prisma.merchProductImage.findFirst({
    where: { id: params.imageId, productId: params.id },
  });
  if (!image) return jsonError("ไม่พบรูปที่ระบุ", 404);

  await prisma.merchProductImage.delete({ where: { id: image.id } });
  await deleteObject(MERCH_PRODUCTS_BUCKET, image.imageKey).catch((err) =>
    console.error("[DELETE /api/admin/merch/products/[id]/gallery/[imageId]] cleanup failed:", err)
  );

  return NextResponse.json({ ok: true });
}
