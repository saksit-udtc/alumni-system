import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { logAdminAction } from "@/lib/auditLog";

const PACKAGE_ADMIN_ROLES = ["SUPER_ADMIN", "MERCH_STAFF", "RESERVATION_STAFF"] as const;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req, [...PACKAGE_ADMIN_ROLES]);
  if (!admin) return response;

  const pkg = await prisma.package.findUnique({
    where: { id: params.id },
    include: {
      event: { select: { id: true, name: true, eventDate: true, status: true, seatsPerTable: true } },
      items: { include: { product: { select: { id: true, name: true, requiresSize: true } } } },
    },
  });
  if (!pkg) return jsonError("ไม่พบแพ็กเกจที่ระบุ", 404);

  return NextResponse.json({ package: pkg });
}

interface PackageItemInput {
  productId: string;
  size?: string | null;
  quantity: number;
  buyerChoosesSize?: boolean;
}

function validateItems(items: unknown): { error?: string; clean?: PackageItemInput[] } {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการในแพ็กเกจ" };
  }
  const clean: PackageItemInput[] = [];
  for (const raw of items) {
    const productId = typeof raw?.productId === "string" ? raw.productId : "";
    const buyerChoosesSize = raw?.buyerChoosesSize === true;
    const size = !buyerChoosesSize && typeof raw?.size === "string" && raw.size.trim() ? raw.size.trim() : null;
    const quantity = Number(raw?.quantity);
    if (!productId) return { error: "ข้อมูลสินค้าในแพ็กเกจไม่ถูกต้อง" };
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { error: "จำนวนสินค้าต้องเป็นจำนวนเต็มมากกว่า 0" };
    }
    clean.push({ productId, size, quantity, buyerChoosesSize });
  }
  return { clean };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req, [...PACKAGE_ADMIN_ROLES]);
  if (!admin) return response;

  const existing = await prisma.package.findUnique({ where: { id: params.id } });
  if (!existing) return jsonError("ไม่พบแพ็กเกจที่ระบุ", 404);

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const merchOnly = body?.bookingType === "none";
  const bookingType = body?.bookingType === "full_table" || body?.bookingType === "seats" ? body.bookingType : "";
  const seatCount = Number(body?.seatCount);
  const price = Number(body?.price);
  const active = typeof body?.active === "boolean" ? body.active : existing.active;

  if (!name) return jsonError("กรุณาระบุชื่อแพ็กเกจ");
  if (!merchOnly && !bookingType) return jsonError("กรุณาเลือกรูปแบบการจอง");
  if (!merchOnly && (!Number.isInteger(seatCount) || seatCount <= 0)) {
    return jsonError("จำนวนที่นั่งต้องเป็นจำนวนเต็มมากกว่า 0");
  }
  if (!Number.isFinite(price) || price < 0) return jsonError("ราคาแพ็กเกจไม่ถูกต้อง");

  const { error, clean } = validateItems(body?.items);
  if (error || !clean) return jsonError(error!);

  // Validated against the event's actual table capacities, not
  // Event.seatsPerTable — see the same note in ../route.ts's POST. Not
  // applicable to a merch-only package (no table at all).
  const event = await prisma.event.findUnique({ where: { id: existing.eventId }, include: { tables: true } });
  if (!merchOnly && event && bookingType === "full_table" && !event.tables.some((t) => t.capacity === seatCount)) {
    const capacities = Array.from(new Set(event.tables.map((t) => t.capacity))).sort((a, b) => a - b);
    return jsonError(
      capacities.length > 0
        ? `จำนวนที่นั่งต้องตรงกับความจุของโต๊ะที่มีอยู่จริงในงานนี้ (${capacities.join(", ")} ที่นั่ง)`
        : "งานนี้ยังไม่มีโต๊ะให้เลือก กรุณาเพิ่มโต๊ะก่อนสร้างแพ็กเกจแบบเหมาทั้งโต๊ะ"
    );
  }

  // Matched by plain productId+size fields, not the productId_size
  // compound-unique helper — see the same note in ../route.ts's POST.
  // buyerChoosesSize items are checked more loosely (any stock row at all).
  for (const item of clean) {
    const stock = item.buyerChoosesSize
      ? await prisma.merchProductStock.findFirst({ where: { productId: item.productId } })
      : await prisma.merchProductStock.findFirst({ where: { productId: item.productId, size: item.size } });
    if (!stock) {
      return jsonError("มีสินค้าในแพ็กเกจที่ไม่มีข้อมูลสต๊อกตรงกับไซส์ที่เลือก กรุณาตรวจสอบอีกครั้ง");
    }
  }

  // Item list is fully replaced on every edit — packages are small
  // (a handful of bundled items), so delete-then-recreate inside a
  // transaction is simpler and safer than diffing.
  const pkg = await prisma.$transaction(async (tx) => {
    await tx.packageItem.deleteMany({ where: { packageId: params.id } });
    return tx.package.update({
      where: { id: params.id },
      data: {
        name,
        description: description || null,
        bookingType: merchOnly ? null : bookingType,
        seatCount: merchOnly ? null : seatCount,
        price,
        active,
        items: {
          create: clean.map((item) => ({
            productId: item.productId,
            size: item.size,
            quantity: item.quantity,
            buyerChoosesSize: item.buyerChoosesSize || false,
          })),
        },
      },
      include: { items: true },
    });
  });

  await logAdminAction({
    adminId: admin.adminId,
    action: "PACKAGE_UPDATE",
    targetType: "Package",
    targetId: pkg.id,
    detail: `แก้ไขแพ็กเกจ "${pkg.name}"`,
  });

  return NextResponse.json({ package: pkg });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req, [...PACKAGE_ADMIN_ROLES]);
  if (!admin) return response;

  const existing = await prisma.package.findUnique({
    where: { id: params.id },
    include: { _count: { select: { reservations: true } } },
  });
  if (!existing) return jsonError("ไม่พบแพ็กเกจที่ระบุ", 404);

  if (existing._count.reservations > 0) {
    return jsonError(
      "แพ็กเกจนี้มีประวัติการขายแล้ว ไม่สามารถลบได้ — กรุณาปิดการขาย (ปิดใช้งาน) แทน"
    );
  }

  await prisma.$transaction([
    prisma.packageItem.deleteMany({ where: { packageId: params.id } }),
    prisma.package.delete({ where: { id: params.id } }),
  ]);

  await logAdminAction({
    adminId: admin.adminId,
    action: "PACKAGE_DELETE",
    targetType: "Package",
    targetId: params.id,
    detail: `ลบแพ็กเกจ "${existing.name}"`,
  });

  return NextResponse.json({ ok: true });
}
