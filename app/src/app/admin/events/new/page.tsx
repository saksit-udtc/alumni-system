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
  const [zones, setZones] = useState([
    { name: "โซน A", tableCount: 10, color: "#2563eb" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const ZONE_COLORS = ["#2563eb", "#f97316", "#16a34a", "#dc2626", "#9333ea", "#0891b2", "#ca8a04", "#db2777"];

  function addZone() {
    setZones((prev) => [
      ...prev,
      { name: `โซน ${String.fromCharCode(65 + prev.length)}`, tableCount: 5, color: ZONE_COLORS[prev.length % ZONE_COLORS.length] },
    ]);
  }

  function updateZone(index: number, part: Partial<{ name: string; tableCount: number; color: string }>) {
    setZones((prev) => prev.map((z, i) => (i === index ? { ...z, ...part } : z)));
  }

  function removeZone(index: number) {
    setZones((prev) => prev.filter((_, i) => i !== index));
  }

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
      // When zones are enabled, one POST per zone (sequential, not
      // Promise.all — the API numbers tables off the current max, so
      // concurrent calls would race and could duplicate table numbers).
      if (useZones) {
        for (const z of zones) {
          if (z.tableCount > 0) {
            await fetch(`/api/admin/events/${event.id}/tables`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                count: z.tableCount,
                capacity: seatsPerTable,
                zone: z.name || undefined,
                zoneColor: z.color || undefined,
              }),
            });
          }
        }
      } else if (tableCount > 0) {
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
          {!useZones && (
            <label className="flex flex-col gap-1">
              <span className="text-sm text-slate-600">จำนวนโต๊ะ</span>
              <input
                type="number"
                value={tableCount}
                onChange={(e) => setTableCount(Number(e.target.value))}
                className="border rounded px-3 py-2 max-w-[160px]"
              />
            </label>
          )}

          {useZones && (
            <div className="flex flex-col gap-3">
              {zones.map((z, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2 border border-slate-200 rounded-lg p-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-500">ชื่อโซน</span>
                    <input
                      value={z.name}
                      onChange={(e) => updateZone(i, { name: e.target.value })}
                      className="border rounded px-3 py-2 w-40"
                      placeholder="เช่น VIP, ใกล้เวที"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-500">จำนวนโต๊ะ</span>
                    <input
                      type="number"
                      value={z.tableCount}
                      onChange={(e) => updateZone(i, { tableCount: Number(e.target.value) })}
                      className="border rounded px-3 py-2 w-24"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-500">สีโซน</span>
                    <input
                      type="color"
                      value={z.color}
                      onChange={(e) => updateZone(i, { color: e.target.value })}
                      className="border rounded h-[42px] w-14 p-1"
                    />
                  </label>
                  {zones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeZone(i)}
                      className="text-sm text-red-500 hover:underline px-2 py-2"
                    >
                      ลบโซน
                    </button>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={addZone}
                  className="text-sm text-primary-700 hover:underline"
                >
                  + เพิ่มโซน
                </button>
                <span className="text-xs text-slate-500">
                  รวมทั้งหมด {zones.reduce((sum, z) => sum + (Number(z.tableCount) || 0), 0)} โต๊ะ
                </span>
              </div>
            </div>
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
