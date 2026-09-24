import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { deleteObject, MERCH_PRODUCTS_BUCKET, publicMerchProductUrl } from "@/lib/minio";
import { validateMerchImage, storeMerchImage } from "@/lib/merchImageUpload";

// Upload (or replace) the back-side photo of a product (front = the cover image).
// The shop's detail view shows a ด้านหน้า/ด้านหลัง toggle once this is set.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF"]);
  if (response) return response;

  const product = await prisma.merchProduct.findUnique({ where: { id: params.id } });
  if (!product) return jsonError("ไม่พบสินค้าที่ระบุ", 404);

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file") as File | null;
  const invalid = validateMerchImage(file);
  if (invalid) return jsonError(invalid);

  const key = await storeMerchImage(params.id, file as File);
  const previousKey = product.backImageKey;
  await prisma.merchProduct.update({ where: { id: params.id }, data: { backImageKey: key } });

  if (previousKey) {
    await deleteObject(MERCH_PRODUCTS_BUCKET, previousKey).catch((err) =>
      console.error("[POST /api/admin/merch/products/[id]/back-image] old image cleanup failed:", err)
    );
  }

  return NextResponse.json({ backImageUrl: publicMerchProductUrl(key) });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF"]);
  if (response) return response;

  const product = await prisma.merchProduct.findUnique({ where: { id: params.id } });
  if (!product) return jsonError("ไม่พบสินค้าที่ระบุ", 404);

  await prisma.merchProduct.update({ where: { id: params.id }, data: { backImageKey: null } });
  if (product.backImageKey) {
    await deleteObject(MERCH_PRODUCTS_BUCKET, product.backImageKey).catch((err) =>
      console.error("[DELETE /api/admin/merch/products/[id]/back-image] cleanup failed:", err)
    );
  }

  return NextResponse.json({ ok: true });
}
