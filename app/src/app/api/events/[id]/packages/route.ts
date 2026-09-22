import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public: active packages a guest can buy for this event's table-booking
// page (Phase 2 of the package feature — see /admin/packages for how these
// are configured). Seat-level booking is disabled site-wide (see
// api/reservations/route.ts's "only full_table" check), so only
// full_table packages are ever offered here even though the admin side
// (POS) can also create "seats" packages — those stay POS-only by design.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event || event.status === "draft") {
    return NextResponse.json({ error: "ไม่พบงานที่ระบุ" }, { status: 404 });
  }

  const packages = await prisma.package.findMany({
    where: { eventId: params.id, active: true, bookingType: "full_table" },
    orderBy: { createdAt: "asc" },
    include: {
      items: {
        include: {
          product: { select: { name: true, stocks: { select: { size: true, quantity: true } } } },
        },
      },
    },
  });

  return NextResponse.json({
    packages: packages.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      seatCount: p.seatCount,
      items: p.items.map((it) => ({
        packageItemId: it.id,
        productName: it.product.name,
        size: it.size,
        quantity: it.quantity,
        buyerChoosesSize: it.buyerChoosesSize,
        // Only needed when buyerChoosesSize is true — the guest picks from
        // real in-stock sizes, same set POS/admin would offer.
        availableSizes: it.buyerChoosesSize
          ? it.product.stocks.filter((s) => s.quantity > 0).map((s) => s.size || "")
          : [],
      })),
    })),
  });
}
