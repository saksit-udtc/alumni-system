import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiHelpers";
import { presignedGetUrl, PAYMENT_SLIPS_BUCKET } from "@/lib/minio";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "FINANCE_STAFF"]);
  if (response) return response;

  const reservations = await prisma.reservation.findMany({
    where: { eventId: params.id },
    include: {
      table: { select: { tableNumber: true } },
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
