"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import TableMap from "./table-map";
import EventHeaderStats from "./event-header-stats";
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
      <main className="max-w-4xl mx-auto p-4 space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-maroon-700 px-5 py-6 shadow-lg shadow-maroon-900/20">
        <div className="relative">
          <h1 className="text-2xl font-display font-semibold text-primary-200">{event.name}</h1>
          <p className="text-cream-50/80 mt-1">
            {new Date(event.eventDate).toLocaleString("th-TH")}
          </p>
          {event.location && <p className="text-cream-50/80">{event.location}</p>}
        </div>
      </section>

      <EventHeaderStats tables={tables} />

      <section>
        <h2 className="text-lg font-display font-semibold text-stone-800 mb-3">ผังโต๊ะ</h2>
        <TableMap
          eventId={event.id}
          eventOpen={event.status === "open"}
          floorPlanUrl={event.floorPlanPublicUrl}
          tables={tables}
          pricePerTable={Number(event.pricePerTable)}
          pricePerSeat={Number(event.pricePerSeat)}
        />
      </section>
      </main>
    </div>
  );
}
