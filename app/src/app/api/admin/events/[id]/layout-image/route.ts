import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { uploadObject, FLOOR_PLANS_BUCKET, publicFloorPlanUrl } from "@/lib/minio";
import { setEventLayoutImageKey } from "@/lib/settings";
import crypto from "crypto";

// Admin: ภาพแผนผังการจัดงาน (ภาพย่อบนหน้าจองโต๊ะ) — แยกจากภาพพื้นหลังผังโต๊ะ
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "RESERVATION_STAFF"]);
  if (response) return response;

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return jsonError("ไม่พบงานที่ระบุ", 404);

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
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const fileKey = `layout/${params.id}/${crypto.randomUUID()}.${ext}`;

  await uploadObject(FLOOR_PLANS_BUCKET, fileKey, buffer, file.type || "image/png");
  await setEventLayoutImageKey(params.id, fileKey);

  return NextResponse.json({ layoutImageUrl: publicFloorPlanUrl(fileKey) });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "RESERVATION_STAFF"]);
  if (response) return response;
  await setEventLayoutImageKey(params.id, null);
  return NextResponse.json({ ok: true });
}
