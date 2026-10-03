"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import TableMap from "./table-map";
import type { TableRow } from "./table-graphic";
import SiteNav from "@/app/components/site-nav";
import PageTitle from "@/app/components/page-title";

// Always poll fresh event + table data — the floor plan image, table
// positions, and booking counts can change any time (an admin edit, or
// another guest booking), same as the old app's 15s refresh interval.
const POLL_MS = 15000;

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<any>(null);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState(false);

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
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLightbox(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

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
      <PageTitle
        banner
        title="จองโต๊ะงานเลี้ยง"
      />

      <main className="max-w-4xl mx-auto p-4 space-y-3">

      <div className="flex items-stretch gap-3">
      {event.layoutImageUrl && (
        <button
          type="button"
          onClick={() => setLightbox(true)}
          className="shrink-0 bg-white border border-cream-200 shadow-md rounded-xl p-2 flex flex-col items-center gap-1 hover:border-primary-400 transition-colors cursor-zoom-in"
          aria-label="ดูแผนผังการจัดงานแบบเต็มจอ"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.layoutImageUrl} alt="แผนผังการจัดงาน" className="w-20 h-20 sm:w-24 sm:h-24 object-cover object-top rounded-md" />
          <span className="text-[11px] text-stone-500 leading-tight">แผนผังงาน · คลิกขยาย</span>
        </button>
      )}
      <div className="flex-1 flex flex-wrap items-center justify-between gap-3 bg-white border border-cream-200 shadow-md rounded-xl px-4 py-3">
        <div className="text-sm sm:text-base text-stone-700 leading-relaxed">
          จองโต๊ะ{" "}
          <span className="text-2xl font-display font-semibold text-maroon-700">{Number(event.pricePerTable).toLocaleString()}</span>{" "}
          บาท ต่อโต๊ะ ({tables[0]?.capacity ?? 8} ที่นั่ง) เชิญคลิกเลือกโต๊ะด้านล่าง
          <br />
          หรือติดต่อ คุณแพ็ททรียา เจียมสันต์ (แพตตี้) โทร.{" "}
          <a href="tel:0643191010" className="font-semibold text-maroon-700 no-underline">
            064-319-1010
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#22c55e", border: "1.5px solid #16a34a" }} />
            โต๊ะว่าง
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#ef4444", border: "1.5px solid #dc2626" }} />
            โต๊ะจองแล้ว
          </span>
        </div>
      </div>
      </div>

      {lightbox && event.layoutImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 cursor-zoom-out"
          onClick={() => setLightbox(false)}
        >
          <button
            type="button"
            onClick={() => setLightbox(false)}
            className="absolute top-3 right-3 text-white bg-black/50 hover:bg-black/70 rounded-full w-10 h-10 text-2xl leading-none"
            aria-label="ปิด"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.layoutImageUrl}
            alt="แผนผังการจัดงาน"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

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
