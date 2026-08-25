"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import TableMap from "./table-map";
import EventHeaderStats from "./event-header-stats";
import type { TableRow } from "./table-graphic";

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

  if (error) return <main className="max-w-4xl mx-auto p-4 text-red-600">{error}</main>;
  if (!event) return <main className="max-w-4xl mx-auto p-4">กำลังโหลด...</main>;

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <p className="text-blue-500">
            {new Date(event.eventDate).toLocaleString("th-TH")}
          </p>
          {event.location && <p className="text-blue-500">{event.location}</p>}
        </div>
        <EventHeaderStats tables={tables} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">ผังโต๊ะ</h2>
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
  );
}
