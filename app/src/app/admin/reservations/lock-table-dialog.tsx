"use client";

import { useEffect, useState } from "react";

/**
 * แอดมินล็อกโต๊ะให้ผู้จองรอชำระเงินหลายวัน (เฉพาะโต๊ะ) — เรียก POST /api/admin/reservations/lock
 * ผู้จองจะได้อีเมลพร้อมลิงก์ชำระเงิน/แนบสลิป; ครบกำหนดแล้วไม่จ่าย ระบบปล่อยโต๊ะเอง
 */
export default function LockTableDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [events, setEvents] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [eventId, setEventId] = useState("");
  const [tableId, setTableId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [days, setDays] = useState("3");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ bookingCode: string; reservedUntil: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/events")
      .then((r) => r.json())
      .then((d) => {
        const open = (d.events || []).filter((e: any) => e.status === "open");
        setEvents(open);
        if (open.length === 1) setEventId(open[0].id);
      });
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.tableLongHoldDays && setDays(String(d.tableLongHoldDays)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setTableId("");
    setTables([]);
    if (!eventId) return;
    fetch(`/api/admin/events/${eventId}/tables`)
      .then((r) => r.json())
      .then((d) => setTables((d.tables || []).filter((t: any) => t.seatsReserved === 0 && !t.isFullTableBooking)));
  }, [eventId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/reservations/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, tableId, bookerName: name, bookerPhone: phone, bookerEmail: email, days: Number(days) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ล็อกโต๊ะไม่สำเร็จ");
        return;
      }
      setResult({ bookingCode: data.bookingCode, reservedUntil: data.reservedUntil });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  const input = "border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-display font-semibold text-stone-800">ล็อกโต๊ะรอชำระเงิน</h2>
        {result ? (
          <div className="space-y-3 mt-3">
            <p className="text-emerald-700 text-sm">
              ล็อกโต๊ะสำเร็จ — รหัสการจอง <b>{result.bookingCode}</b> กันโต๊ะถึง{" "}
              {new Date(result.reservedUntil).toLocaleString("th-TH", { dateStyle: "long", timeStyle: "short" })} น.
              ส่งอีเมลพร้อมลิงก์ชำระเงินให้ผู้จองแล้ว
            </p>
            <button onClick={onClose} className="bg-maroon-700 hover:bg-maroon-800 text-white rounded-lg px-4 py-2 text-sm">ปิด</button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3 mt-3 text-sm">
            <p className="text-stone-500">กันโต๊ะให้ผู้จองตามจำนวนวันที่กำหนด หากไม่ชำระภายในเวลา ระบบจะปล่อยโต๊ะอัตโนมัติ</p>
            <label className="flex flex-col gap-1">
              <span className="font-medium">งานเลี้ยง</span>
              <select value={eventId} onChange={(e) => setEventId(e.target.value)} required className={input}>
                <option value="">-- เลือกงาน --</option>
                {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium">โต๊ะที่ยังว่าง</span>
              <select value={tableId} onChange={(e) => setTableId(e.target.value)} required disabled={!eventId} className={input}>
                <option value="">{eventId ? "-- เลือกโต๊ะ --" : "เลือกงานก่อน"}</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>โต๊ะ {t.tableNumber}{t.zone ? ` (โซน ${t.zone})` : ""} · {t.capacity} ที่นั่ง</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium">ชื่อ-นามสกุลผู้จอง</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required className={input} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium">เบอร์โทรศัพท์</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" className={input} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium">อีเมล (ใช้ส่งลิงก์ชำระเงิน)</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={input} />
            </label>
            <label className="flex items-center gap-2">
              <span className="font-medium">ล็อกไว้</span>
              <input type="number" min={1} max={14} step={1} value={days} onChange={(e) => setDays(e.target.value)} required className={`w-20 ${input}`} />
              <span>วัน</span>
            </label>
            {error && <p className="text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={onClose} className="border border-stone-300 rounded-lg px-4 py-2 text-stone-700 hover:bg-cream-50">ยกเลิก</button>
              <button type="submit" disabled={busy} className="bg-maroon-700 hover:bg-maroon-800 disabled:opacity-60 text-white rounded-lg px-4 py-2 font-semibold">
                {busy ? "กำลังล็อก..." : "ล็อกโต๊ะ"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
