"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import StatusToggle from "./status-toggle";
import { zoneColor } from "@/lib/zone-colors";
import AdminFloorPlanOverview from "./admin-floor-plan-overview";
import { AdminStatCard } from "@/app/components/admin-stat-card";

type Table = {
  id: string;
  tableNumber: number;
  zone: string | null;
  capacity: number;
  seatsReserved: number;
  isFullTableBooking: boolean;
  positionX: number | null;
  positionY: number | null;
};

// Table card color by booking state: fully booked (all seats taken, or a
// full-table booking) is green, partially booked is amber, untouched stays
// plain white/gray — matches the traffic-light convention used elsewhere
// in the admin (green = confirmed, amber = pending) so it reads instantly.
// Ported from the old Supabase app's admin event detail page.
function tableCardClasses(t: Table) {
  const isFull = t.isFullTableBooking || t.seatsReserved >= t.capacity;
  const isPartial = !isFull && t.seatsReserved > 0;
  if (isFull) return "rounded-lg border-2 border-emerald-400 bg-emerald-50 p-3";
  if (isPartial) return "rounded-lg border-2 border-amber-300 bg-amber-50 p-3";
  return "rounded-lg border border-cream-200 bg-white p-3";
}

export default function AdminEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/events/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!data) return <p className="text-stone-400 text-sm">กำลังโหลด...</p>;
  const { event, stats } = data;
  const allTables: Table[] = event.tables ?? [];

  const totalTables = allTables.length;
  const bookedTables = allTables.filter((t) => t.seatsReserved > 0).length;
  const totalSeats = allTables.reduce((sum, t) => sum + t.capacity, 0);
  const reservedSeats = allTables.reduce((sum, t) => sum + t.seatsReserved, 0);

  const zoneNames = Array.from(new Set(allTables.map((t) => t.zone ?? "ไม่ระบุโซน")));
  const hasZones = allTables.some((t) => t.zone);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold text-stone-800">{event.name}</h1>
          <p className="text-stone-500 text-sm">
            {new Date(event.eventDate).toLocaleString("th-TH")} · {event.location}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/events/${id}/edit`} className="text-sm rounded-lg border border-stone-300 hover:bg-cream-50 transition-colors px-3 py-1.5 text-stone-700">
            แก้ไขข้อมูลงาน
          </Link>
          <Link href={`/admin/events/${id}/tables`} className="text-sm rounded-lg border border-stone-300 hover:bg-cream-50 transition-colors px-3 py-1.5 text-stone-700">
            จัดการโต๊ะ & โซน
          </Link>
          <Link href={`/admin/events/${id}/floor-plan`} className="text-sm rounded-lg border border-stone-300 hover:bg-cream-50 transition-colors px-3 py-1.5 text-stone-700">
            ผังพื้นที่งาน
          </Link>
          <StatusToggle eventId={event.id} status={event.status} />
        </div>
      </div>

      <Link
        href={`/admin/events/${id}/reservations`}
        className="inline-block text-sm rounded-lg bg-maroon-700 hover:bg-maroon-800 transition-colors text-white px-4 py-2 font-medium shadow-sm"
      >
        รายชื่อผู้จอง & ตรวจสลิป
      </Link>

      <section>
        <h2 className="text-lg font-display font-semibold text-stone-800 mb-3">ภาพรวม</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <AdminStatCard icon="table" label="โต๊ะที่ถูกจอง" value={`${bookedTables}/${totalTables}`} tone="violet" />
          <AdminStatCard icon="seat" label="ที่นั่งที่จองแล้ว" value={`${reservedSeats}/${totalSeats}`} tone="sky" />
          <AdminStatCard
            icon="coin"
            label="ยอดเงินยืนยันแล้ว"
            value={`${Number(stats.totalRevenue).toLocaleString()} บาท`}
            sub={`${stats.confirmedCount} รายการ`}
            tone="emerald"
          />
          <AdminStatCard icon="clock" label="รอตรวจสอบ/รอชำระ" value={String(stats.pendingCount)} sub="รายการ" tone="amber" />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-display font-semibold text-stone-800 mb-3">ผังโต๊ะ (ภาพรวม)</h2>
        {/* Same FloorPlanMap component + aspect-ratio math as the public
            event page, but this page (unlike the public one) has no
            max-width wrapper — without a cap here the floor plan stretches
            to the full admin viewport instead of the ~896px the public page
            renders at, so the same plan looks like a different shape/scale
            side by side even though the underlying ratio math is identical. */}
        {event.floorPlanPublicUrl ? (
          <div className="max-w-4xl">
          <AdminFloorPlanOverview
            eventId={event.id}
            floorPlanUrl={event.floorPlanPublicUrl}
            tables={allTables.map((t) => ({
              ...t,
              seatsRemaining: t.capacity - t.seatsReserved,
              alumniBookers: [],
              posX: t.positionX,
              posY: t.positionY,
            }))}
            pricePerTable={Number(event.pricePerTable)}
            pricePerSeat={Number(event.pricePerSeat)}
          />
          </div>
        ) : hasZones ? (
          <div className="space-y-6">
            {zoneNames.map((zone) => (
              <div key={zone}>
                <h3 className="text-sm font-semibold text-stone-600 mb-2 flex items-center gap-1.5">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ background: zoneColor(zone === "ไม่ระบุโซน" ? null : zone).bg }}
                  />
                  โซน: {zone}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {allTables
                    .filter((t) => (t.zone ?? "ไม่ระบุโซน") === zone)
                    .map((t) => (
                      <div key={t.id} className={tableCardClasses(t)}>
                        <div className="font-semibold text-stone-800">โต๊ะ {t.tableNumber}</div>
                        <div className="text-xs text-stone-500">
                          {t.isFullTableBooking ? "เหมาแล้ว" : `${t.seatsReserved}/${t.capacity} ที่นั่ง`}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {allTables.map((t) => (
              <div key={t.id} className="rounded-lg border border-cream-200 shadow-md bg-white p-3">
                <div className="font-semibold text-stone-800">โต๊ะ {t.tableNumber}</div>
                <div className="text-xs text-stone-500">
                  {t.isFullTableBooking ? "เหมาแล้ว" : `${t.seatsReserved}/${t.capacity} ที่นั่ง`}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
