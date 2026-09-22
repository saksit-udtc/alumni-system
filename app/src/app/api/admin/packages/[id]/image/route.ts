import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { uploadObject, deleteObject, MERCH_PRODUCTS_BUCKET, publicMerchProductUrl } from "@/lib/minio";
import crypto from "crypto";

const PACKAGE_ADMIN_ROLES = ["SUPER_ADMIN", "MERCH_STAFF", "RESERVATION_STAFF"] as const;

// Package cover images share the merch-products bucket (no separate bucket
// needed — same rationale as MerchProduct.imageKey), just under a
// "packages/" key prefix so they don't collide with product image keys.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, [...PACKAGE_ADMIN_ROLES]);
  if (response) return response;

  const pkg = await prisma.package.findUnique({ where: { id: params.id } });
  if (!pkg) return jsonError("ไม่พบแพ็กเกจที่ระบุ", 404);

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file") as File | null;
  if (!file) return jsonError("กรุณาแนบไฟล์รูปแพ็กเกจ");

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
  const fileKey = `packages/${params.id}/${crypto.randomUUID()}.${ext}`;

  await uploadObject(MERCH_PRODUCTS_BUCKET, fileKey, buffer, file.type || "image/png");

  const previousKey = pkg.imageKey;
  const updated = await prisma.package.update({
    where: { id: params.id },
    data: { imageKey: fileKey },
  });

  if (previousKey) {
    await deleteObject(MERCH_PRODUCTS_BUCKET, previousKey).catch((err) =>
      console.error("[POST /api/admin/packages/[id]/image] old image cleanup failed:", err)
    );
  }

  return NextResponse.json({ imageKey: updated.imageKey, imageUrl: publicMerchProductUrl(fileKey) });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, [...PACKAGE_ADMIN_ROLES]);
  if (response) return response;

  const existing = await prisma.package.findUnique({ where: { id: params.id } });
  if (!existing) return jsonError("ไม่พบแพ็กเกจที่ระบุ", 404);

  await prisma.package.update({ where: { id: params.id }, data: { imageKey: null } });

  if (existing.imageKey) {
    await deleteObject(MERCH_PRODUCTS_BUCKET, existing.imageKey).catch((err) =>
      console.error("[DELETE /api/admin/packages/[id]/image] image cleanup failed:", err)
    );
  }

  return NextResponse.json({ ok: true });
}
