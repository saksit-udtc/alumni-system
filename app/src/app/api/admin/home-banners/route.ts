import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { uploadObject, HOME_BANNERS_BUCKET, publicHomeBannerUrl } from "@/lib/minio";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const banners = await prisma.homeBanner.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    banners: banners.map((b) => ({
      id: b.id,
      title: b.title,
      linkUrl: b.linkUrl,
      sortOrder: b.sortOrder,
      active: b.active,
      imageUrl: publicHomeBannerUrl(b.imageKey),
    })),
  });
}

// Creates a banner and uploads its image in one step — the image IS the
// banner, so unlike merch products there's no separate metadata-only
// creation step.
export async function POST(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file") as File | null;
  if (!file) return jsonError("กรุณาแนบไฟล์รูปแบนเนอร์");

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    return jsonError("รองรับเฉพาะไฟล์ภาพ JPEG, PNG หรือ WEBP เท่านั้น");
  }
  if (file.size > MAX_SIZE_BYTES) {
    return jsonError("ไฟล์ภาพต้องมีขนาดไม่เกิน 10MB");
  }

  const title = (formData?.get("title") as string | null)?.trim() || null;
  const linkUrl = (formData?.get("linkUrl") as string | null)?.trim() || null;

  const maxSort = await prisma.homeBanner.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const fileKey = `${crypto.randomUUID()}.${ext}`;

  await uploadObject(HOME_BANNERS_BUCKET, fileKey, buffer, file.type || "image/png");

  const banner = await prisma.homeBanner.create({
    data: { imageKey: fileKey, title, linkUrl, sortOrder },
  });

  return NextResponse.json({
    banner: {
      id: banner.id,
      title: banner.title,
      linkUrl: banner.linkUrl,
      sortOrder: banner.sortOrder,
      active: banner.active,
      imageUrl: publicHomeBannerUrl(banner.imageKey),
    },
  });
}
