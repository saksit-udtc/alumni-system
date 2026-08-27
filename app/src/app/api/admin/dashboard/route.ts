import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiHelpers";

export const dynamic = "force-dynamic";

const PENDING_STATUSES = ["pending", "awaiting_verify"] as const;

export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req);
  if (response) return response;

  const [
    totalEvents,
    openEvents,
    draftEvents,
    closedEvents,
    totalAlumni,
    reservationGroups,
    checkedInCount,
    merchGroups,
    recentEvents,
  ] = await Promise.all([
    prisma.event.count(),
    prisma.event.count({ where: { status: "open" } }),
    prisma.event.count({ where: { status: "draft" } }),
    prisma.event.count({ where: { status: "closed" } }),
    prisma.alumni.count(),
    prisma.reservation.groupBy({
      by: ["paymentStatus"],
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.reservation.count({ where: { checkedIn: true } }),
    prisma.merchOrder.groupBy({
      by: ["paymentStatus"],
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.event.findMany({
      orderBy: { eventDate: "desc" },
      take: 5,
      include: { _count: { select: { tables: true, reservations: true } } },
    }),
  ]);

  function summarize(groups: { paymentStatus: string; _count: { _all: number }; _sum: { totalAmount: unknown } }[]) {
    let total = 0;
    let pending = 0;
    let confirmed = 0;
    let confirmedRevenue = 0;
    for (const g of groups) {
      total += g._count._all;
      if ((PENDING_STATUSES as readonly string[]).includes(g.paymentStatus)) pending += g._count._all;
      if (g.paymentStatus === "confirmed") {
        confirmed += g._count._all;
        confirmedRevenue += Number(g._sum.totalAmount || 0);
      }
    }
    return { total, pending, confirmed, confirmedRevenue };
  }

  return NextResponse.json({
    events: { total: totalEvents, open: openEvents, draft: draftEvents, closed: closedEvents },
    reservations: { ...summarize(reservationGroups), checkedIn: checkedInCount },
    merch: summarize(merchGroups),
    alumni: { total: totalAlumni },
    recentEvents: recentEvents.map((e) => ({
      id: e.id,
      name: e.name,
      eventDate: e.eventDate,
      status: e.status,
      tableCount: e._count.tables,
      reservationCount: e._count.reservations,
    })),
  });
}
