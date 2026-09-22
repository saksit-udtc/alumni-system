import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { logAdminAction } from "@/lib/auditLog";
import { publicMerchProductUrl } from "@/lib/minio";

// Plain GET, no dynamic route segment, reads the DB — force-dynamic so
// Next.js doesn't try to prerender this at Docker build time (see the same
// note on ../pos/products/route.ts).
export const dynamic = "force-dynamic";

const PACKAGE_ADMIN_ROLES = ["SUPER_ADMIN", "MERCH_STAFF", "RESERVATION_STAFF"] as const;

export async function GET(req: NextRequest) {
  const { admin, response } = requireAdmin(req, [...PACKAGE_ADMIN_ROLES]);
  if (!admin) return response;

  const packages = await prisma.package.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      event: { select: { id: true, name: true, eventDate: true, status: true } },
      items: {
        include: { product: { select: { id: true, name: true, requiresSize: true } } },
      },
      // merchOrders counts online orders of a merch-only package (see
      // lib/createMerchPackageOrder.ts); reservations counts table+merch
      // package sales. A package only ever accrues one or the other.
      _count: { select: { reservations: true, merchOrders: true } },
    },
  });

  return NextResponse.json({
    packages: packages.map((p) => ({
      ...p,
      imageUrl: p.imageKey ? publicMerchProductUrl(p.imageKey) : null,
    })),
  });
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
    // A buyer-choice item always stores size:null in config — the actual
    // size is picked per-purchase (see lib/bookPackage.ts / lib/
    // createMerchPackageOrder.ts), so any size the admin form sent for it
    // is ignored rather than trusted.
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

export async function POST(req: NextRequest) {
  const { admin, response } = requireAdmin(req, [...PACKAGE_ADMIN_ROLES]);
  if (!admin) return response;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const eventId = typeof body?.eventId === "string" ? body.eventId : "";
  // "none" (from the admin form's package-type toggle) means a merch-only
  // package — no table involved at all, sold ONLINE ONLY through the merch
  // shop, never at the POS counter (see lib/createMerchPackageOrder.ts).
  // Stored as bookingType:null.
  const merchOnly = body?.bookingType === "none";
  const bookingType = body?.bookingType === "full_table" || body?.bookingType === "seats" ? body.bookingType : "";
  const seatCount = Number(body?.seatCount);
  const price = Number(body?.price);

  if (!name) return jsonError("กรุณาระบุชื่อแพ็กเกจ");
  if (!eventId) return jsonError("กรุณาเลือกงาน");
  if (!merchOnly && !bookingType) return jsonError("กรุณาเลือกรูปแบบการจอง");
  if (!merchOnly && (!Number.isInteger(seatCount) || seatCount <= 0)) {
    return jsonError("จำนวนที่นั่งต้องเป็นจำนวนเต็มมากกว่า 0");
  }
  if (!Number.isFinite(price) || price < 0) return jsonError("ราคาแพ็กเกจไม่ถูกต้อง");

  const { error, clean } = validateItems(body?.items);
  if (error || !clean) return jsonError(error!);

  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { tables: true } });
  if (!event) return jsonError("ไม่พบงานที่ระบุ", 404);

  // full_table packages are sold against a specific table at booking time
  // (see lib/bookPackage.ts), and that check is against the TABLE's own
  // capacity — which can differ table-to-table and isn't guaranteed to
  // match Event.seatsPerTable (that field is only a default suggested
  // capacity for new tables, not an enforced constraint). So validate here
  // against the event's actual tables instead: if seatCount doesn't match
  // any of them, this package could never be sold to any table and every
  // POS/online purchase attempt would fail at booking time — catch that
  // now instead. Not applicable to a merch-only package (no table at all).
  if (!merchOnly && bookingType === "full_table" && !event.tables.some((t) => t.capacity === seatCount)) {
    const capacities = Array.from(new Set(event.tables.map((t) => t.capacity))).sort((a, b) => a - b);
    return jsonError(
      capacities.length > 0
        ? `จำนวนที่นั่งต้องตรงกับความจุของโต๊ะที่มีอยู่จริงในงานนี้ (${capacities.join(", ")} ที่นั่ง)`
        : "งานนี้ยังไม่มีโต๊ะให้เลือก กรุณาเพิ่มโต๊ะก่อนสร้างแพ็กเกจแบบเหมาทั้งโต๊ะ"
    );
  }

  // Validate every referenced product actually has stock rows to fulfill
  // it, so we never create a package that can never be sold. A fixed-size
  // item is matched by plain productId+size fields (not the productId_size
  // compound-unique helper) since size can be null — same convention as
  // lib/bookPackage.ts. A buyerChoosesSize item is checked more loosely
  // (any stock row for the product exists at all) since the actual size
  // is only known at purchase time.
  for (const item of clean) {
    const stock = item.buyerChoosesSize
      ? await prisma.merchProductStock.findFirst({ where: { productId: item.productId } })
      : await prisma.merchProductStock.findFirst({ where: { productId: item.productId, size: item.size } });
    if (!stock) {
      return jsonError("มีสินค้าในแพ็กเกจที่ไม่มีข้อมูลสต๊อกตรงกับไซส์ที่เลือก กรุณาตรวจสอบอีกครั้ง");
    }
  }

  const pkg = await prisma.package.create({
    data: {
      name,
      description: description || null,
      eventId,
      bookingType: merchOnly ? null : bookingType,
      seatCount: merchOnly ? null : seatCount,
      price,
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

  await logAdminAction({
    adminId: admin.adminId,
    action: "PACKAGE_CREATE",
    targetType: "Package",
    targetId: pkg.id,
    detail: `สร้างแพ็กเกจ "${pkg.name}"`,
  });

  return NextResponse.json({ package: pkg }, { status: 201 });
}
