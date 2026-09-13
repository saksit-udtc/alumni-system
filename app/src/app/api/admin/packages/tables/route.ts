import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";

// Self-contained table list for a given event, filtered to tables that can
// still accept the given booking shape — used by both the package admin
// UI (to sanity-check a package's seatCount, indirectly) and the POS
// package-sale flow (to let the cashier pick an available table). Kept
// separate from any existing tables endpoint for the same "don't touch
// unread deep files" reasoning as the other new endpoints in this feature.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF", "RESERVATION_STAFF"]);
  if (!admin) return response;

  const eventId = req.nextUrl.searchParams.get("eventId") || "";
  const bookingType = req.nextUrl.searchParams.get("bookingType") || "";
  const seatCount = Number(req.nextUrl.searchParams.get("seatCount") || "0");
  if (!eventId) return jsonError("ต้องระบุ eventId");

  const tables = await prisma.table.findMany({
    where: { eventId },
    orderBy: { tableNumber: "asc" },
  });

  const available = tables.filter((t) => {
    if (bookingType === "full_table") {
      return t.seatsReserved === 0 && t.capacity === (seatCount || t.capacity);
    }
    if (bookingType === "seats" && seatCount > 0) {
      return !t.isFullTableBooking && t.seatsReserved + seatCount <= t.capacity;
    }
    // No booking-type filter given — just exclude fully-committed tables.
    return !t.isFullTableBooking && t.seatsReserved < t.capacity;
  });

  return NextResponse.json({
    tables: available.map((t) => ({
      id: t.id,
      tableNumber: t.tableNumber,
      capacity: t.capacity,
      seatsReserved: t.seatsReserved,
      isFullTableBooking: t.isFullTableBooking,
      zone: t.zone,
    })),
  });
}
