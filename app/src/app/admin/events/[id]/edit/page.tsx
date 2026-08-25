"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DateTimeFields, DateParts, combineDate, splitDate } from "../../date-time-fields";

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<any>(null);
  const [dateParts, setDateParts] = useState<DateParts | null>(null);

  useEffect(() => {
    fetch(`/api/admin/events/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const ev = d.event;
        setForm({
          name: ev.name,
          location: ev.location || "",
          seatsPerTable: ev.seatsPerTable,
          pricePerTable: ev.pricePerTable,
          pricePerSeat: ev.pricePerSeat,
          status: ev.status,
        });
        setDateParts(splitDate(ev.eventDate));
      });
  }, [id]);

  if (!form || !dateParts) return <p>กำลังโหลด...</p>;

  function updateDatePart(part: Partial<DateParts>) {
    setDateParts((prev) => (prev ? { ...prev, ...part } : prev));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const eventDate = combineDate(dateParts!.day, dateParts!.month, dateParts!.yearBE, dateParts!.hour, dateParts!.minute);
    await fetch(`/api/admin/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, eventDate }),
    });
    router.push(`/admin/events/${id}`);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-4">แก้ไขข้อมูลงานเลี้ยง</h1>
      <form onSubmit={save} className="bg-white rounded-xl shadow p-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-600">ชื่องาน</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border rounded px-3 py-2" />
        </label>

        <DateTimeFields value={dateParts} onChange={updateDatePart} />

        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-600">สถานที่</span>
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="border rounded px-3 py-2" placeholder="สถานที่" />
        </label>
        <input type="number" value={form.seatsPerTable} onChange={(e) => setForm({ ...form, seatsPerTable: Number(e.target.value) })} className="border rounded px-3 py-2" placeholder="ที่นั่งต่อโต๊ะ" />
        <input type="number" value={form.pricePerTable} onChange={(e) => setForm({ ...form, pricePerTable: Number(e.target.value) })} className="border rounded px-3 py-2" placeholder="ราคาทั้งโต๊ะ" />
        <input type="number" value={form.pricePerSeat} onChange={(e) => setForm({ ...form, pricePerSeat: Number(e.target.value) })} className="border rounded px-3 py-2" placeholder="ราคาต่อที่นั่ง" />
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="border rounded px-3 py-2">
          <option value="draft">ร่าง</option>
          <option value="open">เปิดจอง</option>
          <option value="closed">ปิดรับจอง</option>
        </select>
        <button className="bg-primary-600 text-white rounded py-2">บันทึก</button>
      </form>
    </div>
  );
}
