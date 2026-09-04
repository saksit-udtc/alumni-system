import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { deleteObject, HOME_BANNERS_BUCKET } from "@/lib/minio";

// Partial update — title / linkUrl / sortOrder / active. Image replacement
// is not handled here (delete + re-add is simpler for a promo banner that
// changes rarely); this keeps the admin UI's reorder/toggle actions cheap.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const existing = await prisma.homeBanner.findUnique({ where: { id: params.id } });
  if (!existing) return jsonError("ไม่พบแบนเนอร์ที่ระบุ", 404);

  const body = await req.json().catch(() => ({}));
  const data: { title?: string | null; linkUrl?: string | null; sortOrder?: number; active?: boolean } = {};

  if ("title" in body) data.title = body.title ? String(body.title).trim() || null : null;
  if ("linkUrl" in body) data.linkUrl = body.linkUrl ? String(body.linkUrl).trim() || null : null;
  if ("sortOrder" in body) data.sortOrder = Number(body.sortOrder) || 0;
  if ("active" in body) data.active = Boolean(body.active);

  const updated = await prisma.homeBanner.update({ where: { id: params.id }, data });
  return NextResponse.json({ id: updated.id, active: updated.active, sortOrder: updated.sortOrder });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const existing = await prisma.homeBanner.findUnique({ where: { id: params.id } });
  if (!existing) return jsonError("ไม่พบแบนเนอร์ที่ระบุ", 404);

  await prisma.homeBanner.delete({ where: { id: params.id } });
  await deleteObject(HOME_BANNERS_BUCKET, existing.imageKey).catch((err) =>
    console.error("[DELETE /api/admin/home-banners/[id]] image cleanup failed:", err)
  );

  return NextResponse.json({ ok: true });
}
