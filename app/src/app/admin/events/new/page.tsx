"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DateTimeFields, DateParts, combineDate, defaultDateParts } from "../date-time-fields";

export default function NewEventPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [dateParts, setDateParts] = useState<DateParts>(defaultDateParts());
  const [seatsPerTable, setSeatsPerTable] = useState(10);
  const [pricePerTable, setPricePerTable] = useState(0);
  const [pricePerSeat, setPricePerSeat] = useState(0);
  const [useZones, setUseZones] = useState(false);
  const [tableCount, setTableCount] = useState(10);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateDatePart(part: Partial<DateParts>) {
    setDateParts((prev) => ({ ...prev, ...part }));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("กรุณากรอกชื่องาน");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const eventDate = combineDate(dateParts.day, dateParts.month, dateParts.yearBE, dateParts.hour, dateParts.minute);
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          eventDate,
          location: location || undefined,
          seatsPerTable,
          pricePerTable,
          pricePerSeat,
          status: "draft",
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "สร้างงานไม่สำเร็จ");
        return;
      }
      const { event } = await res.json();

      // Pre-populate the event with its tables right away — using the same
      // bulk-add endpoint the "จัดการโต๊ะ & โซน" page uses — so the admin
      // doesn't land on an empty floor plan after creating the event.
      // Zone name/color assignment for individual tables still happens
      // afterwards on that management page; this checkbox is just a heads
      // up that zones exist as a concept for this event.
      if (tableCount > 0) {
        await fetch(`/api/admin/events/${event.id}/tables`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count: tableCount, capacity: seatsPerTable }),
        });
      }

      router.push(`/admin/events/${event.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-4">สร้างงานเลี้ยงใหม่</h1>
      <form onSubmit={create} className="flex flex-col gap-4">
        <section className="bg-white rounded-xl shadow p-4 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-primary-700">ข้อมูลงาน</h2>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-600">ชื่องาน</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="border rounded px-3 py-2" required />
          </label>

          <DateTimeFields value={dateParts} onChange={updateDatePart} />

          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-600">สถานที่</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className="border rounded px-3 py-2" />
          </label>
        </section>

        <section className="bg-white rounded-xl shadow p-4 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-primary-700">ที่นั่งและราคา</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-slate-600">ที่นั่งต่อโต๊ะ</span>
              <input
                type="number"
                value={seatsPerTable}
                onChange={(e) => setSeatsPerTable(Number(e.target.value))}
                className="border rounded px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-slate-600">ราคาเหมาโต๊ะ</span>
              <input
                type="number"
                value={pricePerTable}
                onChange={(e) => setPricePerTable(Number(e.target.value))}
                className="border rounded px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-slate-600">ราคาต่อที่นั่ง</span>
              <input
                type="number"
                value={pricePerSeat}
                onChange={(e) => setPricePerSeat(Number(e.target.value))}
                className="border rounded px-3 py-2"
              />
            </label>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow p-4 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-primary-700">การจัดโต๊ะ</h2>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={useZones} onChange={(e) => setUseZones(e.target.checked)} className="rounded border-slate-300" />
            แบ่งโต๊ะเป็นโซน (เช่น VIP, ใกล้เวที, โซนตามรุ่น)
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-600">จำนวนโต๊ะ</span>
            <input
              type="number"
              value={tableCount}
              onChange={(e) => setTableCount(Number(e.target.value))}
              className="border rounded px-3 py-2 max-w-[160px]"
            />
          </label>
          {useZones && (
            <p className="text-xs text-slate-500">
              สร้างงานก่อน แล้วไปตั้งชื่อ/สีโซนของแต่ละโต๊ะได้ที่หน้า &ldquo;จัดการโต๊ะ &amp; โซน&rdquo;
            </p>
          )}
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button disabled={saving} className="bg-primary-700 hover:bg-primary-800 transition-colors text-white rounded-lg py-3 font-medium disabled:opacity-50">
          {saving ? "กำลังสร้าง..." : "สร้างงาน (สถานะร่าง)"}
        </button>
      </form>
    </div>
  );
}
