"use client";
import type { TableRow } from "./table-graphic";

// Compact table stats shown next to the event title, so guests see
// availability at a glance before scrolling down to the map.
//
// Unlike the old Supabase app's EventHeaderStats (which self-fetched
// `/api/events/[id]/tables` on its own 15s interval), this scaffold has no
// standalone tables endpoint and the parent event page already polls
// `/api/events/[id]` — so `tables` arrives as a prop, kept in sync with the
// same data TableMap renders instead of a second independent fetch loop.
export default function EventHeaderStats({ tables }: { tables: TableRow[] }) {
  if (tables.length === 0) return null;

  const totalTables = tables.length;
  const bookedTables = tables.filter((t) => t.isFullTableBooking || t.seatsRemaining === 0).length;
  const availableTables = totalTables - bookedTables;
  const totalSeats = tables.reduce((sum, t) => sum + t.capacity, 0);
  const reservedSeats = tables.reduce((sum, t) => sum + t.seatsReserved, 0);

  const stats = [
    { value: totalTables, label: "โต๊ะทั้งหมด", color: "text-maroon-700" },
    { value: bookedTables, label: "โต๊ะจอง/เต็มแล้ว", color: "text-red-600" },
    { value: availableTables, label: "โต๊ะว่าง", color: "text-emerald-600" },
    { value: `${reservedSeats}/${totalSeats}`, label: "ที่นั่งที่จองแล้ว", color: "text-maroon-700" },
  ];

  return (
    // Full-width 4-up strip (2 columns on narrow phones) placed below the
    // hero as its own section, rather than squeezed beside the title — a
    // fixed-width stat block floating next to a short title inside a
    // justify-between hero left an awkward empty gap between them.
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="bg-white border border-cream-200 shadow-md rounded-xl px-4 py-4 text-center">
          <div className={`text-2xl font-display font-semibold ${s.color}`}>{s.value}</div>
          <div className="text-xs text-stone-500 mt-1">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
