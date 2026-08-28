import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { uploadObject, deleteObject, MERCH_PRODUCTS_BUCKET, publicMerchProductUrl } from "@/lib/minio";
import crypto from "crypto";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF"]);
  if (response) return response;

  const product = await prisma.merchProduct.findUnique({ where: { id: params.id } });
  if (!product) return jsonError("ไม่พบสินค้าที่ระบุ", 404);

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file") as File | null;
  if (!file) return jsonError("กรุณาแนบไฟล์รูปสินค้า");

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    return jsonError("รองรับเฉพาะไฟล์ภาพ JPEG, PNG หรือ WEBP เท่านั้น");
  }
  if (file.size > MAX_SIZE_BYTES) {
    return jsonError("ไฟล์ภาพต้องมีขนาดไม่เกิน 10MB");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const fileKey = `${params.id}/${crypto.randomUUID()}.${ext}`;

  await uploadObject(MERCH_PRODUCTS_BUCKET, fileKey, buffer, file.type || "image/png");

  const previousKey = product.imageKey;
  const updated = await prisma.merchProduct.update({
    where: { id: params.id },
    data: { imageKey: fileKey },
  });

  if (previousKey) {
    await deleteObject(MERCH_PRODUCTS_BUCKET, previousKey).catch((err) =>
      console.error("[POST /api/admin/merch/products/[id]/image] old image cleanup failed:", err)
    );
  }

  return NextResponse.json({ imageKey: updated.imageKey, imageUrl: publicMerchProductUrl(fileKey) });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF"]);
  if (response) return response;

  const existing = await prisma.merchProduct.findUnique({ where: { id: params.id } });
  if (!existing) return jsonError("ไม่พบสินค้าที่ระบุ", 404);

  await prisma.merchProduct.update({ where: { id: params.id }, data: { imageKey: null } });

  if (existing.imageKey) {
    await deleteObject(MERCH_PRODUCTS_BUCKET, existing.imageKey).catch((err) =>
      console.error("[DELETE /api/admin/merch/products/[id]/image] image cleanup failed:", err)
    );
  }

  return NextResponse.json({ ok: true });
}
