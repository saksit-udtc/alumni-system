import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiHelpers";

export const dynamic = "force-dynamic";

const PENDING_STATUSES = ["pending", "awaiting_verify"] as const;
// นิยาม "สลิปน่าสงสัย" และ "สต็อกใกล้หมด" ใช้ชุดเดียวกับกระดิ่งแจ้งเตือน (lib/adminTodo.ts)

const DAY_MS = 86_400_000;
const BKK_OFFSET_MS = 7 * 3_600_000; // Asia/Bangkok (UTC+7, ไม่มี DST)

export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  // ช่วงวันของกราฟการจองรายวัน: 7 / 14 / 30 วัน (ค่าอื่นถือเป็น 7)
  const daysParam = Number(req.nextUrl.searchParams.get("days"));
  const rangeDays = [7, 14, 30].includes(daysParam) ? daysParam : 7;
  const nowBkk = new Date(Date.now() + BKK_OFFSET_MS);
  const todayStartUtc = Date.UTC(nowBkk.getUTCFullYear(), nowBkk.getUTCMonth(), nowBkk.getUTCDate()) - BKK_OFFSET_MS;
  const rangeStart = new Date(todayStartUtc - (rangeDays - 1) * DAY_MS);

  const [
    totalEvents,
    openEvents,
    draftEvents,
    closedEvents,
    totalAlumni,
    reservationGroups,
    checkedInCount,
    merchGroups,
    rangeReservations,
    rangeMerch,
    recentReservations,
    recentMerchOrders,
    merchToShip,
    merchShipped,
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
    prisma.reservation.findMany({
      where: { createdAt: { gte: rangeStart } },
      select: { createdAt: true },
    }),
    prisma.merchOrder.findMany({
      where: { createdAt: { gte: rangeStart } },
      select: { createdAt: true },
    }),
    prisma.reservation.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        bookingCode: true,
        bookerName: true,
        totalAmount: true,
        paymentStatus: true,
        createdAt: true,
        table: { select: { tableNumber: true } },
        slips: { orderBy: { uploadedAt: "desc" }, take: 1, select: { easyslipStatus: true } },
      },
    }),
    prisma.merchOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        orderCode: true,
        bookerName: true,
        totalAmount: true,
        paymentStatus: true,
        createdAt: true,
        items: { select: { quantity: true } },
      },
    }),
    prisma.merchOrder.count({ where: { paymentStatus: "confirmed", trackingNumber: null } }),
    prisma.merchOrder.count({ where: { trackingNumber: { not: null } } }),
  ]);

  function summarize(groups: { paymentStatus: string; _count: { _all: number }; _sum: { totalAmount: unknown } }[]) {
    let total = 0;
    let pending = 0;
    let confirmed = 0;
    let confirmedRevenue = 0;
    const byStatus: Record<string, number> = { pending: 0, awaiting_verify: 0, confirmed: 0, rejected: 0, expired: 0 };
    for (const g of groups) {
      total += g._count._all;
      byStatus[g.paymentStatus] = (byStatus[g.paymentStatus] || 0) + g._count._all;
      if ((PENDING_STATUSES as readonly string[]).includes(g.paymentStatus)) pending += g._count._all;
      if (g.paymentStatus === "confirmed") {
        confirmed += g._count._all;
        confirmedRevenue += Number(g._sum.totalAmount || 0);
      }
    }
    return { total, pending, confirmed, confirmedRevenue, byStatus };
  }

  // นับการจองต่อวัน (ตามวันที่ตามเวลาไทย) — วันที่ไม่มีการจองต้องได้ 0 ไม่ใช่หายไป
  const daily = Array.from({ length: rangeDays }, (_, i) => ({
    date: new Date(rangeStart.getTime() + i * DAY_MS + BKK_OFFSET_MS).toISOString().slice(0, 10),
    count: 0,
  }));
  for (const r of rangeReservations) {
    const idx = Math.floor((r.createdAt.getTime() - rangeStart.getTime()) / DAY_MS);
    if (idx >= 0 && idx < rangeDays) daily[idx].count++;
  }

  const merchDaily = daily.map((d) => ({ date: d.date, count: 0 }));
  for (const r of rangeMerch) {
    const idx = Math.floor((r.createdAt.getTime() - rangeStart.getTime()) / DAY_MS);
    if (idx >= 0 && idx < rangeDays) merchDaily[idx].count++;
  }

  const reservations = summarize(reservationGroups);
  const merch = summarize(merchGroups);

  return NextResponse.json({
    events: { total: totalEvents, open: openEvents, draft: draftEvents, closed: closedEvents },
    reservations: { ...reservations, checkedIn: checkedInCount },
    merch: { ...merch, toShip: merchToShip, shipped: merchShipped },
    alumni: { total: totalAlumni },
    rangeDays,
    daily,
    merchDaily,
    recentReservations: recentReservations.map((r) => ({
      id: r.id,
      bookingCode: r.bookingCode,
      bookerName: r.bookerName,
      tableNumber: r.table.tableNumber,
      totalAmount: Number(r.totalAmount),
      paymentStatus: r.paymentStatus,
      createdAt: r.createdAt,
      easyslipStatus: r.slips[0]?.easyslipStatus ?? null,
    })),
    recentMerchOrders: recentMerchOrders.map((o) => ({
      id: o.id,
      orderCode: o.orderCode,
      bookerName: o.bookerName,
      totalAmount: Number(o.totalAmount),
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt,
      itemCount: o.items.reduce((a, it) => a + it.quantity, 0),
    })),
  });
}
