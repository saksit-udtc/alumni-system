"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import TableMap from "./table-map";
import type { TableRow } from "./table-graphic";
import SiteNav from "@/app/components/site-nav";

// Always poll fresh event + table data — the floor plan image, table
// positions, and booking counts can change any time (an admin edit, or
// another guest booking), same as the old app's 15s refresh interval.
const POLL_MS = 15000;

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<any>(null);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [eventRes, badgesRes] = await Promise.all([
      fetch(`/api/events/${id}`, { cache: "no-store" }),
      fetch(`/api/events/${id}/alumni-badges`, { cache: "no-store" }),
    ]);
    const eventData = await eventRes.json();
    if (!eventRes.ok) {
      setError(eventData.error || "ไม่พบงานที่ระบุ");
      return;
    }
    const badgesData = await badgesRes.json().catch(() => ({ badgesByTable: {} }));
    const badgesByTable: Record<string, { department: string | null; graduationYear: string | null }[]> =
      badgesData.badgesByTable || {};

    setEvent(eventData.event);
    setTables(
      (eventData.tables || []).map((t: any): TableRow => ({
        id: t.id,
        tableNumber: t.tableNumber,
        zone: t.zone,
        capacity: t.capacity,
        seatsReserved: t.seatsReserved,
        seatsRemaining: t.seatsAvailable,
        isFullTableBooking: t.isFullTableBooking,
        alumniBookers: badgesByTable[t.id] || [],
        posX: t.positionX,
        posY: t.positionY,
      }))
    );
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  if (error) {
    return (
      <div>
        <SiteNav />
        <main className="max-w-4xl mx-auto p-4 text-red-600">{error}</main>
      </div>
    );
  }
  if (!event) {
    return (
      <div>
        <SiteNav />
        <main className="max-w-4xl mx-auto p-4 text-stone-500">กำลังโหลด...</main>
      </div>
    );
  }

  return (
    <div>
      <SiteNav />
      <section className="relative overflow-hidden bg-maroon-700">
        <div className="relative max-w-6xl mx-auto px-4 py-12 sm:py-16 text-center">
          <span className="inline-block text-xs font-medium tracking-wide uppercase bg-white/10 text-primary-200 rounded-full px-3 py-1 mb-4 border border-primary-400/30">
            จองโต๊ะงานเลี้ยง
          </span>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold text-white leading-snug">{event.name}</h1>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-cream-50/80">
            <span>{new Date(event.eventDate).toLocaleDateString("th-TH", { dateStyle: "long" })}</span>
            <span>{new Date(event.eventDate).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.</span>
            {event.location && <span>{event.location}</span>}
          </div>
        </div>
      </section>

      <main className="max-w-4xl mx-auto p-4 space-y-3">

      {/* Line 2: price + table-status legend, moved up here (out of the
          floor plan card below) so it reads right under the event's basic
          info instead of buried further down the page. */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-cream-200 shadow-md rounded-xl px-4 py-3">
        <div>
          <span className="text-2xl font-display font-semibold text-maroon-700">{Number(event.pricePerTable).toLocaleString()}</span>
          <span className="text-sm text-stone-500"> บาท/โต๊ะ (เหมา)</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#22c55e", border: "1.5px solid #16a34a" }} />
            โต๊ะว่าง (คลิกเพื่อเหมาโต๊ะ)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#ef4444", border: "1.5px solid #dc2626" }} />
            โต๊ะจองแล้ว
          </span>
        </div>
      </div>

      <TableMap
        eventId={event.id}
        eventOpen={event.status === "open"}
        floorPlanUrl={event.floorPlanPublicUrl}
        tables={tables}
        pricePerTable={Number(event.pricePerTable)}
        pricePerSeat={Number(event.pricePerSeat)}
      />
      </main>
    </div>
  );
}
