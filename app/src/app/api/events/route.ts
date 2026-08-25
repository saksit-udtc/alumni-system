import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public: list events (open + closed; draft hidden from public list)
export async function GET() {
  const events = await prisma.event.findMany({
    where: { status: { in: ["open", "closed"] } },
    orderBy: { eventDate: "desc" },
    select: {
      id: true,
      name: true,
      eventDate: true,
      location: true,
      status: true,
      pricePerTable: true,
      pricePerSeat: true,
    },
  });
  return NextResponse.json({ events });
}
