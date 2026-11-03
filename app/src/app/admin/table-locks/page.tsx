"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * การล็อคโต๊ะ — แอดมินล็อกโต๊ะไม่ให้ใครกดจองได้ (ปุ่มเปิด/ปิดการล็อกต่อโต๊ะ + เลือกหลายโต๊ะ)
 * ไม่เกี่ยวกับรายการจอง: โต๊ะที่มีผู้จองอยู่แล้วจะล็อกไม่ได้ ปลดล็อกแล้วกลับมาจองได้ตามปกติ
 */
type TableRow = {
  id: string;
  tableNumber: number;
  capacity: number;
  zone: string | null;
  seatsReserved: number;
  isFullTableBooking: boolean;
  isLocked: boolean;
};

export default function TableLocksPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [eventId, setEventId] = useState("");
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [zone, setZone] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/events")
      .then((r) => r.json())
      .then((d) => {
        const list = d.events || [];
        setEvents(list);
        const open = list.find((e: any) => e.status === "open") || list[0];
        if (open) setEventId(open.id);
      });
  }, []);

  function load(id = eventId) {
    if (!id) return;
    setLoading(true);
    fetch(`/api/admin/events/${id}/tables`)
      .then((r) => r.json())
      .then((d) => setTables(d.tables || []))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    setSelected(new Set());
    setMessage("");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const hasBooking = (t: TableRow) => t.seatsReserved > 0 || t.isFullTableBooking;
  const zones = useMemo(() => Array.from(new Set(tables.map((t) => t.zone).filter(Boolean))) as string[], [tables]);
  const visible = tables.filter((t) => {
    if (zone !== "all" && (t.zone || "") !== zone) return false;
    if (status === "locked" && !t.isLocked) return false;
    if (status === "free" && (t.isLocked || hasBooking(t))) return false;
    if (status === "booked" && !hasBooking(t)) return false;
    if (q.trim() && !String(t.tableNumber).includes(q.trim())) return false;
    return true;
  });

  async function setLock(ids: string[], locked: boolean) {
    if (ids.length === 0) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/tables/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableIds: ids, locked }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "บันทึกไม่สำเร็จ");
        return;
      }
      const skipped: number[] = data.skipped || [];
      setMessage(
        `${locked ? "ล็อก" : "ปลดล็อก"}แล้ว ${data.changed} โต๊ะ` +
          (skipped.length ? ` — ข้ามโต๊ะที่มีการจองอยู่: ${skipped.join(", ")}` : "")
      );
      setSelected(new Set());
      load();
    } finally {
      setBusy(false);
    }
  }

  const lockedCount = tables.filter((t) => t.isLocked).length;
  const bookedCount = tables.filter((t) => !t.isLocked && hasBooking(t)).length;
  const freeCount = tables.length - lockedCount - bookedCount;
  const allVisibleSelected = visible.length > 0 && visible.every((t) => selected.has(t.id));
  const select = "border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold text-stone-800">การล็อคโต๊ะ</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          ล็อกโต๊ะไม่ให้ผู้จองกดเข้าจองได้ (หน้าเว็บแสดงเป็นไม่ว่าง) เปิด/ปิดการล็อกได้ทุกเมื่อ — ไม่เกี่ยวกับรายการจอง โต๊ะที่มีผู้จองแล้วจะล็อกไม่ได้
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-white border border-cream-200 rounded-xl p-3 shadow-sm"><div className="text-xs text-stone-500">โต๊ะว่าง (จองได้)</div><div className="text-xl font-semibold text-emerald-700">{freeCount}</div></div>
        <div className="bg-white border border-cream-200 rounded-xl p-3 shadow-sm"><div className="text-xs text-stone-500">ล็อกอยู่</div><div className="text-xl font-semibold text-amber-700">{lockedCount}</div></div>
        <div className="bg-white border border-cream-200 rounded-xl p-3 shadow-sm"><div className="text-xs text-stone-500">มีผู้จองแล้ว</div><div className="text-xl font-semibold text-stone-700">{bookedCount}</div></div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <select aria-label="งานเลี้ยง" value={eventId} onChange={(e) => setEventId(e.target.value)} className={select}>
          {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
        <select aria-label="โซน" value={zone} onChange={(e) => setZone(e.target.value)} className={select}>
          <option value="all">ทุกโซน</option>
          {zones.map((z) => <option key={z} value={z}>โซน {z}</option>)}
        </select>
        <select aria-label="สถานะ" value={status} onChange={(e) => setStatus(e.target.value)} className={select}>
          <option value="all">ทุกสถานะ</option>
          <option value="free">ว่าง</option>
          <option value="locked">ล็อกอยู่</option>
          <option value="booked">มีผู้จองแล้ว</option>
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาเลขโต๊ะ" inputMode="numeric" className={`${select} w-36`} />
        <div className="flex gap-2 ml-auto">
          <button disabled={busy || selected.size === 0} onClick={() => setLock(Array.from(selected), true)} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-lg px-3 py-2 text-sm font-medium">
            ล็อกที่เลือก ({selected.size})
          </button>
          <button disabled={busy || selected.size === 0} onClick={() => setLock(Array.from(selected), false)} className="bg-white border border-stone-300 hover:bg-cream-50 disabled:opacity-40 text-stone-700 rounded-lg px-3 py-2 text-sm font-medium">
            ปลดล็อกที่เลือก
          </button>
        </div>
      </div>

      {message && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{message}</p>}

      <div className="bg-white border border-cream-200 rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-cream-50 text-stone-500 text-left">
            <tr>
              <th className="p-3 w-10">
                <input
                  type="checkbox"
                  aria-label="เลือกทั้งหมดที่แสดง"
                  checked={allVisibleSelected}
                  onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((t) => t.id)) : new Set())}
                  className="accent-maroon-700"
                />
              </th>
              <th className="p-3">โต๊ะ</th>
              <th className="p-3">โซน</th>
              <th className="p-3">ที่นั่ง</th>
              <th className="p-3">สถานะ</th>
              <th className="p-3">ล็อกโต๊ะ</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => {
              const booked = hasBooking(t);
              const disabled = busy || (!t.isLocked && booked);
              return (
                <tr key={t.id} className="border-t border-cream-100">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      aria-label={`เลือกโต๊ะ ${t.tableNumber}`}
                      checked={selected.has(t.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(t.id); else next.delete(t.id);
                        setSelected(next);
                      }}
                      className="accent-maroon-700"
                    />
                  </td>
                  <td className="p-3 font-medium">โต๊ะ {t.tableNumber}</td>
                  <td className="p-3">{t.zone || "-"}</td>
                  <td className="p-3">{t.capacity}</td>
                  <td className="p-3">
                    {t.isLocked ? (
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">ล็อกอยู่</span>
                    ) : booked ? (
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-stone-100 text-stone-600 border border-stone-200">มีผู้จองแล้ว</span>
                    ) : (
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">ว่าง</span>
                    )}
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={t.isLocked}
                      aria-label={`ล็อกโต๊ะ ${t.tableNumber}`}
                      disabled={disabled}
                      title={!t.isLocked && booked ? "โต๊ะนี้มีผู้จองแล้ว ล็อกไม่ได้" : undefined}
                      onClick={() => setLock([t.id], !t.isLocked)}
                      className="disabled:opacity-40"
                    >
                      <span className={`relative inline-block w-12 h-7 rounded-full transition-colors duration-300 ${t.isLocked ? "bg-amber-500" : "bg-stone-300"}`}>
                        <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${t.isLocked ? "translate-x-5" : ""}`} />
                      </span>
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-stone-400">ไม่พบโต๊ะ</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
