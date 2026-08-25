"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function AdminTablesPage() {
  const { id } = useParams<{ id: string }>();
  const [tables, setTables] = useState<any[]>([]);
  const [count, setCount] = useState(10);
  const [capacity, setCapacity] = useState(10);
  const [zone, setZone] = useState("");
  const [zoneColor, setZoneColor] = useState("#2563eb");

  function load() {
    fetch(`/api/admin/events/${id}/tables`).then((r) => {
      if (r.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      r.json().then((d) => setTables(d.tables || []));
    });
  }
  useEffect(load, [id]);

  async function bulkAdd(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/admin/events/${id}/tables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count, capacity, zone: zone || undefined, zoneColor }),
    });
    if (!res.ok) {
      if (res.status === 401) {
        alert("เซสชันแอดมินหมดอายุ กรุณาเข้าสู่ระบบใหม่");
        window.location.href = "/admin/login";
        return;
      }
      const d = await res.json().catch(() => ({}));
      alert(d.error || "เพิ่มโต๊ะไม่สำเร็จ");
      return;
    }
    load();
  }

  async function updateTable(tableId: string, patch: any) {
    await fetch(`/api/admin/events/${id}/tables/${tableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  async function deleteTable(tableId: string) {
    if (!confirm("ยืนยันลบโต๊ะนี้?")) return;
    const res = await fetch(`/api/admin/events/${id}/tables/${tableId}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error);
      return;
    }
    load();
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">จัดการโต๊ะ</h1>

      <form onSubmit={bulkAdd} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-5 flex flex-wrap gap-4 items-end">
        <label className="flex flex-col text-sm gap-1 text-slate-600">
          จำนวนโต๊ะที่จะเพิ่ม
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 w-24 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
          />
        </label>
        <label className="flex flex-col text-sm gap-1 text-slate-600">
          ความจุ/โต๊ะ
          <input
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 w-24 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
          />
        </label>
        <label className="flex flex-col text-sm gap-1 text-slate-600">
          โซน
          <input
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 w-24 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
          />
        </label>
        <label className="flex flex-col text-sm gap-1 text-slate-600">
          สี
          <input type="color" value={zoneColor} onChange={(e) => setZoneColor(e.target.value)} className="border border-slate-300 rounded-lg w-12 h-9 cursor-pointer" />
        </label>
        <button className="bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg px-4 py-2 text-sm font-medium shadow-sm">
          + เพิ่มโต๊ะ
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full bg-white text-sm">
          <thead>
            <tr className="text-left bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wide">
              <th className="p-3 font-medium">โต๊ะ</th>
              <th className="p-3 font-medium">ความจุ</th>
              <th className="p-3 font-medium">จองแล้ว</th>
              <th className="p-3 font-medium">โซน</th>
              <th className="p-3 font-medium text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((t, i) => (
              <tr key={t.id} className={`border-b border-slate-100 last:border-b-0 ${i % 2 === 1 ? "bg-slate-50/50" : ""} hover:bg-primary-50/50 transition-colors`}>
                <td className="p-3 font-medium text-slate-700">{t.tableNumber}</td>
                <td className="p-3">
                  <input
                    type="number"
                    defaultValue={t.capacity}
                    onBlur={(e) => updateTable(t.id, { capacity: Number(e.target.value) })}
                    className="border border-slate-300 rounded-lg px-2 py-1 w-16 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
                  />
                </td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      t.seatsReserved > 0 ? "bg-primary-100 text-primary-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {t.seatsReserved} ที่นั่ง
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                      style={{ background: t.zoneColor || "#94a3b8" }}
                    />
                    <input
                      defaultValue={t.zone || ""}
                      onBlur={(e) => updateTable(t.id, { zone: e.target.value })}
                      className="border border-slate-300 rounded-lg px-2 py-1 w-20 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
                    />
                  </div>
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => deleteTable(t.id)}
                    className="text-red-600 hover:text-white hover:bg-red-600 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors border border-red-200 hover:border-red-600"
                  >
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
