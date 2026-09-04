import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { uploadObject, LANDING_ASSETS_BUCKET, publicLandingAssetUrl } from "@/lib/minio";
import crypto from "crypto";

// Generic single-image upload for landing-page fields that store just a
// URL string inside the LandingContent JSON blob (hero background,
// honor-guest photos, sponsor logos) rather than their own DB rows like
// the gallery. Stateless: uploads the file and hands back its public URL;
// the admin page is responsible for putting that URL into the right field
// and saving it via the normal PUT /api/admin/landing.
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

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const fileKey = `${crypto.randomUUID()}.${ext}`;

  await uploadObject(LANDING_ASSETS_BUCKET, fileKey, buffer, file.type || "image/jpeg");

  return NextResponse.json({ imageUrl: publicLandingAssetUrl(fileKey) });
}
