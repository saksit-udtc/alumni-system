import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { uploadObject, LANDING_GALLERY_BUCKET, publicLandingGalleryUrl } from "@/lib/minio";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const images = await prisma.landingGalleryImage.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    images: images.map((g) => ({
      id: g.id,
      caption: g.caption,
      category: g.category,
      sortOrder: g.sortOrder,
      active: g.active,
      imageUrl: publicLandingGalleryUrl(g.imageKey),
    })),
  });
}

// Creates a gallery entry and uploads its photo in one step, same pattern
// as /api/admin/home-banners.
export async function POST(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file") as File | null;
  if (!file) return jsonError("กรุณาแนบไฟล์รูปภาพ");

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    return jsonError("รองรับเฉพาะไฟล์ภาพ JPEG, PNG หรือ WEBP เท่านั้น");
  }
  if (file.size > MAX_SIZE_BYTES) {
    return jsonError("ไฟล์ภาพต้องมีขนาดไม่เกิน 10MB");
  }

  const caption = (formData?.get("caption") as string | null)?.trim() || null;
  const category = (formData?.get("category") as string | null)?.trim() || "ทั่วไป";

  const maxSort = await prisma.landingGalleryImage.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const fileKey = `${crypto.randomUUID()}.${ext}`;

  await uploadObject(LANDING_GALLERY_BUCKET, fileKey, buffer, file.type || "image/jpeg");

  const image = await prisma.landingGalleryImage.create({
    data: { imageKey: fileKey, caption, category, sortOrder },
  });

  return NextResponse.json({
    image: {
      id: image.id,
      caption: image.caption,
      category: image.category,
      sortOrder: image.sortOrder,
      active: image.active,
      imageUrl: publicLandingGalleryUrl(image.imageKey),
    },
  });
}
