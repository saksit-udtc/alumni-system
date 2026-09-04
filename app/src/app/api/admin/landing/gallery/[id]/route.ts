import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { deleteObject, LANDING_GALLERY_BUCKET } from "@/lib/minio";

// Partial update — caption / category / sortOrder / active. Photo
// replacement is not handled here (delete + re-add), same pattern as
// /api/admin/home-banners/[id].
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const existing = await prisma.landingGalleryImage.findUnique({ where: { id: params.id } });
  if (!existing) return jsonError("ไม่พบรูปภาพที่ระบุ", 404);

  const body = await req.json().catch(() => ({}));
  const data: { caption?: string | null; category?: string; sortOrder?: number; active?: boolean } = {};

  if ("caption" in body) data.caption = body.caption ? String(body.caption).trim() || null : null;
  if ("category" in body) data.category = String(body.category).trim() || "ทั่วไป";
  if ("sortOrder" in body) data.sortOrder = Number(body.sortOrder) || 0;
  if ("active" in body) data.active = Boolean(body.active);

  const updated = await prisma.landingGalleryImage.update({ where: { id: params.id }, data });
  return NextResponse.json({ id: updated.id, active: updated.active, sortOrder: updated.sortOrder });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const existing = await prisma.landingGalleryImage.findUnique({ where: { id: params.id } });
  if (!existing) return jsonError("ไม่พบรูปภาพที่ระบุ", 404);

  await prisma.landingGalleryImage.delete({ where: { id: params.id } });
  await deleteObject(LANDING_GALLERY_BUCKET, existing.imageKey).catch((err) =>
    console.error("[DELETE /api/admin/landing/gallery/[id]] image cleanup failed:", err)
  );

  return NextResponse.json({ ok: true });
}
