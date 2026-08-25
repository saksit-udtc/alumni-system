import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";

export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req);
  if (response) return response;

  const q = new URL(req.url).searchParams.get("q")?.trim();
  const alumni = await prisma.alumni.findMany({
    where: q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { department: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ alumni });
}

export async function POST(req: NextRequest) {
  const { response } = requireAdmin(req);
  if (response) return response;

  const body = await req.json().catch(() => null);
  if (!body?.fullName) return jsonError("กรุณากรอกชื่อ-นามสกุล");

  const alumni = await prisma.alumni.create({
    data: {
      fullName: body.fullName,
      graduationYear: body.graduationYear || null,
      department: body.department || null,
      currentOccupation: body.currentOccupation || null,
      phone: body.phone || null,
      email: body.email || null,
      lineId: body.lineId || null,
    },
  });
  return NextResponse.json({ alumni });
}
