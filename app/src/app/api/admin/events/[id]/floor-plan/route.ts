import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { uploadObject, FLOOR_PLANS_BUCKET, publicFloorPlanUrl } from "@/lib/minio";
import crypto from "crypto";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "FINANCE_STAFF", "RESERVATION_STAFF"]);
  if (response) return response;

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return jsonError("ไม่พบงานที่ระบุ", 404);

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file") as File | null;
  if (!file) return jsonError("กรุณาแนบไฟล์ผังโต๊ะ");

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

  await uploadObject(FLOOR_PLANS_BUCKET, fileKey, buffer, file.type || "image/png");

  const updated = await prisma.event.update({
    where: { id: params.id },
    data: { floorPlanUrl: fileKey },
  });

  return NextResponse.json({ floorPlanUrl: updated.floorPlanUrl, publicUrl: publicFloorPlanUrl(fileKey) });
}

// Admin: remove the floor plan — reverts the public table map back to the
// default grid layout. Table positionX/positionY are left as-is (harmless
// if unused) in case the admin re-uploads a plan later and wants them back.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "FINANCE_STAFF", "RESERVATION_STAFF"]);
  if (response) return response;

  const existing = await prisma.event.findUnique({ where: { id: params.id } });
  if (!existing) return jsonError("ไม่พบงานที่ระบุ", 404);

  await prisma.event.update({ where: { id: params.id }, data: { floorPlanUrl: null } });
  return NextResponse.json({ ok: true });
}
