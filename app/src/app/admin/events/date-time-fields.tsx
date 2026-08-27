"use client";

// Shared dropdown-based date/time picker for admin event forms (create +
// edit) — Thai admins expect to pick a Buddhist-era year and a 24-hour time
// from dropdowns rather than type a raw <input type="date">, mirroring how
// the old Supabase-era admin UI looked. Extracted here so the create and
// edit pages don't duplicate the same day/month/year/hour/minute markup.

export const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export type DateParts = { day: number; month: number; yearBE: number; hour: number; minute: number };

// Split a stored ISO datetime into dropdown values.
export function splitDate(iso: string): DateParts {
  const d = new Date(iso);
  return {
    day: d.getDate(),
    month: d.getMonth() + 1,
    yearBE: d.getFullYear() + 543,
    hour: d.getHours(),
    minute: d.getMinutes(),
  };
}

// Recombine dropdown values into an ISO datetime string for the API — this
// always writes local wall-clock time (no timezone shifting), matching how
// eventDate is treated/displayed elsewhere in the app.
export function combineDate(day: number, month: number, yearBE: number, hour: number, minute: number) {
  const d = new Date(yearBE - 543, month - 1, day, hour, minute, 0, 0);
  return d.toISOString();
}

export function defaultDateParts(): DateParts {
  const now = new Date();
  return {
    day: now.getDate(),
    month: now.getMonth() + 1,
    yearBE: now.getFullYear() + 543,
    hour: 18,
    minute: 0,
  };
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

export function DateTimeFields({
  value,
  onChange,
}: {
  value: DateParts;
  onChange: (part: Partial<DateParts>) => void;
}) {
  const currentBE = new Date().getFullYear() + 543;
  const years = Array.from({ length: 8 }, (_, i) => currentBE - 2 + i);

  return (
    <div>
      <span className="text-sm text-stone-600">วันเวลาจัดงาน (ปี พ.ศ.)</span>
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <select value={value.day} onChange={(e) => onChange({ day: Number(e.target.value) })} className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-2 py-2">
          {DAYS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select value={value.month} onChange={(e) => onChange({ month: Number(e.target.value) })} className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-2 py-2">
          {THAI_MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <select value={value.yearBE} onChange={(e) => onChange({ yearBE: Number(e.target.value) })} className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-2 py-2">
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <span className="text-stone-300">|</span>
        <select value={value.hour} onChange={(e) => onChange({ hour: Number(e.target.value) })} className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-2 py-2">
          {HOURS.map((h) => (
            <option key={h} value={h}>{pad2(h)}</option>
          ))}
        </select>
        <span>:</span>
        <select value={value.minute} onChange={(e) => onChange({ minute: Number(e.target.value) })} className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-2 py-2">
          {MINUTES.map((m) => (
            <option key={m} value={m}>{pad2(m)}</option>
          ))}
        </select>
        <span className="text-sm text-stone-500">น. (24 ชม.)</span>
      </div>
    </div>
  );
}
