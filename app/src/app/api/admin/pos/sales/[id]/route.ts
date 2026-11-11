import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { releaseExpiredPosSales } from "@/lib/posSale";

/** One sale's detail — used to render the printable receipt. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req, ["MERCH_STAFF"]);
  if (!admin) return response;

  // ถ้าใบนี้รอชำระและหมดเวลาแล้ว ให้ถูกยกเลิก/คืนสต๊อกก่อนอ่าน เพื่อแสดงสถานะจริง
  await releaseExpiredPosSales().catch((err) => console.error("releaseExpiredPosSales failed", err));

  const sale = await prisma.posSale.findUnique({
    where: { id: params.id },
    include: { items: true, cashier: { select: { username: true } }, package: { select: { name: true } } },
  });
  if (!sale) return jsonError("NOT_FOUND", 404);

  return NextResponse.json({ sale });
}
