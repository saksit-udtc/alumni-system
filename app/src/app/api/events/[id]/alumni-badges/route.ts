import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Requirement #8: public endpoint that joins confirmed/pending/awaiting_verify
 * reservations' bookerPhone against Alumni.phone to show department +
 * graduation-year badges per table on the public floor-plan view — WITHOUT
 * exposing any phone/email publicly. Same phone appearing twice on a table
 * (e.g. duplicate seat rows) is deduped.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const reservations = await prisma.reservation.findMany({
    where: {
      eventId: params.id,
      paymentStatus: { notIn: ["rejected", "expired"] },
    },
    select: { tableId: true, bookerPhone: true },
  });

  const phones = Array.from(new Set(reservations.map((r) => r.bookerPhone).filter(Boolean)));

  const alumniByPhone = new Map<string, { department: string | null; graduationYear: string | null }>();
  if (phones.length) {
    const alumni = await prisma.alumni.findMany({
      where: { phone: { in: phones } },
      select: { phone: true, department: true, graduationYear: true },
    });
    for (const a of alumni) {
      if (a.phone) alumniByPhone.set(a.phone, { department: a.department, graduationYear: a.graduationYear });
    }
  }

  // Build per-table dedup set of phones, then map to badges.
  const tableToPhones = new Map<string, Set<string>>();
  for (const r of reservations) {
    if (!tableToPhones.has(r.tableId)) tableToPhones.set(r.tableId, new Set());
    tableToPhones.get(r.tableId)!.add(r.bookerPhone);
  }

  const result: Record<string, Array<{ department: string | null; graduationYear: string | null }>> = {};
  for (const [tableId, phoneSet] of tableToPhones.entries()) {
    const badges: Array<{ department: string | null; graduationYear: string | null }> = [];
    for (const phone of phoneSet) {
      const match = alumniByPhone.get(phone);
      if (match) badges.push(match);
    }
    result[tableId] = badges;
  }

  return NextResponse.json({ badgesByTable: result });
}
