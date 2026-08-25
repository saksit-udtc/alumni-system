import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Next.js would otherwise try to statically prerender this route at build
// time (it has no dynamic segment and doesn't read the request), which
// fails on Vercel because DATABASE_URL isn't available during `next build`
// — force it to run per-request instead, like every other DB-backed route.
export const dynamic = "force-dynamic";

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
