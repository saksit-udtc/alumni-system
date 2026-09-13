import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiHelpers";

// Self-contained option list for the package admin UI's event picker —
// deliberately its own tiny endpoint rather than reusing whatever the main
// events admin page fetches, so this feature stays independent of it.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF", "RESERVATION_STAFF"]);
  if (!admin) return response;

  const events = await prisma.event.findMany({
    orderBy: { eventDate: "desc" },
    select: {
      id: true,
      name: true,
      eventDate: true,
      status: true,
      seatsPerTable: true,
      tables: { select: { capacity: true } },
    },
  });

  return NextResponse.json({
    events: events.map((ev) => ({
      id: ev.id,
      name: ev.name,
      eventDate: ev.eventDate,
      status: ev.status,
      seatsPerTable: ev.seatsPerTable,
      // Actual table capacities in this event — NOT necessarily all equal
      // to seatsPerTable (that field is only a default for newly-created
      // tables, not an enforced constraint), and this is what a full_table
      // package's seatCount actually has to match at booking time (see
      // lib/bookPackage.ts). Surfaced here so the admin package form can
      // hint the real valid values instead of the possibly-wrong default.
      tableCapacities: Array.from(new Set(ev.tables.map((t) => t.capacity))).sort((a, b) => a - b),
    })),
  });
}
