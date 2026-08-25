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
    { value: totalTables, label: "โต๊ะทั้งหมด", color: "text-blue-900" },
    { value: bookedTables, label: "โต๊ะจอง/เต็มแล้ว", color: "text-red-600" },
    { value: availableTables, label: "โต๊ะว่าง", color: "text-green-600" },
    { value: `${reservedSeats}/${totalSeats}`, label: "ที่นั่งที่จองแล้ว", color: "text-blue-900" },
  ];

  return (
    // 2 columns on narrow phones so the 4 boxes don't force horizontal
    // overflow inside the page's px-4 gutter; back to one row of 4 (sized
    // to balance against the title block) from the sm breakpoint up.
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0 w-full sm:w-auto">
      {stats.map((s) => (
        <div key={s.label} className="bg-white border rounded-lg px-4 py-4 text-center flex flex-col justify-center sm:min-w-[92px]">
          <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          <div className="text-xs text-blue-500 mt-1">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
