import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { deleteObject, MERCH_PRODUCTS_BUCKET, publicMerchProductUrl } from "@/lib/minio";
import { validateMerchImage, storeMerchImage } from "@/lib/merchImageUpload";

// Upload (or replace) the size-chart image shown on the shop's detail view.
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
  const previousKey = product.sizeGuideKey;
  await prisma.merchProduct.update({ where: { id: params.id }, data: { sizeGuideKey: key } });

  if (previousKey) {
    await deleteObject(MERCH_PRODUCTS_BUCKET, previousKey).catch((err) =>
      console.error("[POST /api/admin/merch/products/[id]/size-guide] old image cleanup failed:", err)
    );
  }

  return NextResponse.json({ sizeGuideUrl: publicMerchProductUrl(key) });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF"]);
  if (response) return response;

  const product = await prisma.merchProduct.findUnique({ where: { id: params.id } });
  if (!product) return jsonError("ไม่พบสินค้าที่ระบุ", 404);

  await prisma.merchProduct.update({ where: { id: params.id }, data: { sizeGuideKey: null } });
  if (product.sizeGuideKey) {
    await deleteObject(MERCH_PRODUCTS_BUCKET, product.sizeGuideKey).catch((err) =>
      console.error("[DELETE /api/admin/merch/products/[id]/size-guide] cleanup failed:", err)
    );
  }

  return NextResponse.json({ ok: true });
}
