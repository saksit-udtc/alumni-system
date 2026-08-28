import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const existing = await prisma.alumni.findUnique({ where: { id: params.id } });
  if (!existing) return jsonError("ไม่พบข้อมูลศิษย์เก่า", 404);

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("invalid body");

  const alumni = await prisma.alumni.update({
    where: { id: params.id },
    data: {
      fullName: body.fullName ?? existing.fullName,
      graduationYear: body.graduationYear ?? existing.graduationYear,
      department: body.department ?? existing.department,
      currentOccupation: body.currentOccupation ?? existing.currentOccupation,
      phone: body.phone ?? existing.phone,
      email: body.email ?? existing.email,
      lineId: body.lineId ?? existing.lineId,
    },
  });
  return NextResponse.json({ alumni });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const existing = await prisma.alumni.findUnique({ where: { id: params.id } });
  if (!existing) return jsonError("ไม่พบข้อมูลศิษย์เก่า", 404);

  await prisma.alumni.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
