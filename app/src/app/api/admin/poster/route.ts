import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { getPosterSetting, setPosterImageKey, setPosterEnabled } from "@/lib/settings";
import { getPosterInfo } from "@/lib/poster";
import { uploadObject, deleteObject, LANDING_ASSETS_BUCKET } from "@/lib/minio";
import { logAdminAction } from "@/lib/auditLog";

// โปสเตอร์งานบนหน้าแรก — จัดการได้เฉพาะ SUPER_ADMIN
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export async function GET(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (!admin) return response;
  return NextResponse.json(await getPosterInfo());
}

// อัปโหลดโปสเตอร์ใหม่ (แทนที่ภาพเดิม)
export async function POST(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (!admin) return response;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file") as File | null;
  if (!file) return jsonError("กรุณาแนบไฟล์รูปโปสเตอร์");
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    return jsonError("รองรับเฉพาะไฟล์ภาพ JPEG, PNG หรือ WEBP เท่านั้น");
  }
  if (file.size > MAX_SIZE_BYTES) return jsonError("ไฟล์ภาพต้องมีขนาดไม่เกิน 10MB");

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const key = `poster/${crypto.randomUUID()}.${ext}`;

  const previous = await getPosterSetting();
  await uploadObject(LANDING_ASSETS_BUCKET, key, buffer, file.type || "image/jpeg");
  await setPosterImageKey(key);
  // ลบไฟล์เดิม (ถ้ามี) — ไม่ให้การลบที่พลาดทำให้การอัปโหลดล้มเหลว
  if (previous.imageKey) await deleteObject(LANDING_ASSETS_BUCKET, previous.imageKey).catch(() => {});

  await logAdminAction({
    adminId: admin.adminId,
    action: "POSTER_UPLOAD",
    detail: `อัปโหลดโปสเตอร์ใหม่ (${file.name}, ${Math.round(file.size / 1024)} KB)`,
  });
  return NextResponse.json(await getPosterInfo());
}

// เปิด/ซ่อนส่วนโปสเตอร์บนหน้าแรก
export async function PATCH(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (!admin) return response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.enabled !== "boolean") return jsonError("invalid body");

  await setPosterEnabled(body.enabled);
  await logAdminAction({
    adminId: admin.adminId,
    action: "POSTER_TOGGLE",
    detail: body.enabled ? "แสดงโปสเตอร์บนหน้าแรก" : "ซ่อนโปสเตอร์จากหน้าแรก",
  });
  return NextResponse.json(await getPosterInfo());
}

// กลับไปใช้ภาพเริ่มต้นที่มากับแอป (ลบไฟล์ที่อัปโหลดไว้)
export async function DELETE(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (!admin) return response;

  const current = await getPosterSetting();
  await setPosterImageKey(null);
  if (current.imageKey) await deleteObject(LANDING_ASSETS_BUCKET, current.imageKey).catch(() => {});

  await logAdminAction({
    adminId: admin.adminId,
    action: "POSTER_RESET",
    detail: "กลับไปใช้โปสเตอร์เริ่มต้น",
  });
  return NextResponse.json(await getPosterInfo());
}
