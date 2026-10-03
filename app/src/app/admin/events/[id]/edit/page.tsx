"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DateTimeFields, DateParts, combineDate, splitDate } from "../../date-time-fields";

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<any>(null);
  const [dateParts, setDateParts] = useState<DateParts | null>(null);
  const [layoutUrl, setLayoutUrl] = useState<string | null>(null);
  const [layoutBusy, setLayoutBusy] = useState(false);
  const [layoutMsg, setLayoutMsg] = useState("");

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
        setLayoutUrl(ev.layoutImageUrl || null);
      });
  }, [id]);

  if (!form || !dateParts) return <p className="text-stone-500">กำลังโหลด...</p>;

  function updateDatePart(part: Partial<DateParts>) {
    setDateParts((prev) => (prev ? { ...prev, ...part } : prev));
  }

  async function uploadLayout(file: File) {
    setLayoutBusy(true);
    setLayoutMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/events/${id}/layout-image`, { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "อัปโหลดไม่สำเร็จ");
      setLayoutUrl(d.layoutImageUrl);
      setLayoutMsg("อัปโหลดแล้ว");
    } catch (err: any) {
      setLayoutMsg(err.message || "อัปโหลดไม่สำเร็จ");
    } finally {
      setLayoutBusy(false);
    }
  }

  async function removeLayout() {
    if (!confirm("ลบภาพแผนผังการจัดงาน?")) return;
    setLayoutBusy(true);
    await fetch(`/api/admin/events/${id}/layout-image`, { method: "DELETE" });
    setLayoutUrl(null);
    setLayoutMsg("ลบแล้ว");
    setLayoutBusy(false);
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
      <h1 className="text-2xl font-display font-semibold text-stone-800 mb-5">แก้ไขข้อมูลงานเลี้ยง</h1>
      <form onSubmit={save} className="bg-white rounded-xl border border-cream-200 shadow-md p-5 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-stone-600">ชื่องาน</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-3 py-2" />
        </label>

        <DateTimeFields value={dateParts} onChange={updateDatePart} />

        <label className="flex flex-col gap-1">
          <span className="text-sm text-stone-600">สถานที่</span>
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-3 py-2" placeholder="สถานที่" />
        </label>
        <input type="number" value={form.seatsPerTable} onChange={(e) => setForm({ ...form, seatsPerTable: Number(e.target.value) })} className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-3 py-2" placeholder="ที่นั่งต่อโต๊ะ" />
        <input type="number" value={form.pricePerTable} onChange={(e) => setForm({ ...form, pricePerTable: Number(e.target.value) })} className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-3 py-2" placeholder="ราคาทั้งโต๊ะ" />
        <input type="number" value={form.pricePerSeat} onChange={(e) => setForm({ ...form, pricePerSeat: Number(e.target.value) })} className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-3 py-2" placeholder="ราคาต่อที่นั่ง" />
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-3 py-2">
          <option value="draft">ร่าง</option>
          <option value="open">เปิดจอง</option>
          <option value="closed">ปิดรับจอง</option>
        </select>
        <button className="bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-lg py-2.5 font-medium">บันทึก</button>
      </form>

      <section className="bg-white rounded-xl border border-cream-200 shadow-md p-5 mt-5">
        <h2 className="font-display font-semibold text-stone-800">ภาพแผนผังการจัดงาน</h2>
        <p className="text-xs text-stone-500 mt-0.5 mb-3">
          แสดงเป็นภาพย่อทางซ้ายของราคาบนหน้าจองโต๊ะ ผู้ใช้คลิกเพื่อดูแบบเต็มจอ (JPEG/PNG/WEBP ไม่เกิน 10MB) — อัปโหลดแล้วมีผลทันที ไม่ต้องกดบันทึก
        </p>
        {layoutUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={layoutUrl} alt="แผนผังการจัดงาน" className="max-h-64 rounded-lg border border-cream-200 mb-3" />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <label className={`cursor-pointer bg-maroon-700 hover:bg-maroon-800 text-white text-sm rounded-lg px-4 py-2 ${layoutBusy ? "opacity-50 pointer-events-none" : ""}`}>
            {layoutUrl ? "เปลี่ยนรูป" : "เลือกรูปอัปโหลด"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) uploadLayout(f);
              }}
            />
          </label>
          {layoutUrl && (
            <button type="button" onClick={removeLayout} disabled={layoutBusy} className="text-sm text-red-600 hover:underline">
              ลบรูป
            </button>
          )}
          {layoutBusy && <span className="text-sm text-stone-500">กำลังดำเนินการ...</span>}
          {layoutMsg && !layoutBusy && <span className="text-sm text-stone-600">{layoutMsg}</span>}
        </div>
      </section>
    </div>
  );
}
