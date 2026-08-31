import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiHelpers";
import { presignedGetUrl, PAYMENT_SLIPS_BUCKET } from "@/lib/minio";

/**
 * Global (all-events) reservations list — the FINANCE_STAFF-facing counterpart
 * to /api/admin/events/[id]/reservations, which is scoped to one event and
 * only reachable through the full events management pages (SUPER_ADMIN /
 * RESERVATION_STAFF). FINANCE_STAFF doesn't get events access, so this route
 * gives them (and RESERVATION_STAFF / SUPER_ADMIN, for a one-stop view) every
 * reservation across every event in one list, mirroring the shape of
 * /api/admin/merch/orders.
 */
export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "FINANCE_STAFF", "RESERVATION_STAFF"]);
  if (response) return response;

  const reservations = await prisma.reservation.findMany({
    include: {
      table: { select: { tableNumber: true } },
      event: { select: { name: true } },
      slips: { orderBy: { uploadedAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  const withSlipUrls = await Promise.all(
    reservations.map(async (r) => {
      const latestSlip = r.slips[0];
      const slipUrl = latestSlip ? await presignedGetUrl(PAYMENT_SLIPS_BUCKET, latestSlip.fileKey) : null;
      return {
        id: r.id,
        bookingCode: r.bookingCode,
        eventName: r.event.name,
        tableNumber: r.table.tableNumber,
        bookingType: r.bookingType,
        seatCount: r.seatCount,
        bookerName: r.bookerName,
        bookerPhone: r.bookerPhone,
        bookerEmail: r.bookerEmail,
        paymentStatus: r.paymentStatus,
        totalAmount: r.totalAmount,
        reservedUntil: r.reservedUntil,
        checkedIn: r.checkedIn,
        souvenirGiven: r.souvenirGiven,
        createdAt: r.createdAt,
        latestSlipUrl: slipUrl,
        latestSlipNote: latestSlip?.note || null,
      };
    })
  );

  return NextResponse.json({ reservations: withSlipUrls });
}
