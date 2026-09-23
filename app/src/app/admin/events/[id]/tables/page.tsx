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

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkZone, setBulkZone] = useState("");
  const [bulkColor, setBulkColor] = useState("#2563eb");
  const [bulkBusy, setBulkBusy] = useState(false);

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

  // Selection resets whenever the underlying table list changes (e.g. after
  // a bulk delete) so we never hold onto ids that no longer exist.
  useEffect(() => setSelected(new Set()), [tables.length]);

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

  function toggleSelect(tableId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === tables.length ? new Set() : new Set(tables.map((t) => t.id))));
  }

  // Shared runner for the three bulk actions below: fires one request per
  // selected table (same per-table endpoints the row-level controls already
  // use — no new API needed), then reports any failures together instead of
  // one alert per table.
  async function runBulk(label: string, action: (tableId: string) => Promise<Response>) {
    if (selected.size === 0) return;
    if (!confirm(`ยืนยัน${label} ${selected.size} โต๊ะที่เลือก?`)) return;
    setBulkBusy(true);
    const ids = Array.from(selected);
    const results = await Promise.all(
      ids.map(async (tableId) => {
        const res = await action(tableId);
        if (res.ok) return null;
        const d = await res.json().catch(() => ({}));
        const t = tables.find((x) => x.id === tableId);
        return `โต๊ะ ${t?.tableNumber ?? tableId}: ${d.error || "ไม่สำเร็จ"}`;
      })
    );
    setBulkBusy(false);
    const failures = results.filter(Boolean) as string[];
    load();
    if (failures.length > 0) {
      alert(`${label}สำเร็จบางส่วน มีข้อผิดพลาด ${failures.length} รายการ:\n${failures.join("\n")}`);
    }
  }

  function bulkUpdateZone() {
    const value = bulkZone.trim();
    if (!value) {
      alert("กรุณากรอกชื่อโซนที่จะเปลี่ยน");
      return;
    }
    runBulk("เปลี่ยนชื่อโซน", (tableId) =>
      fetch(`/api/admin/events/${id}/tables/${tableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone: value }),
      })
    );
  }

  function bulkUpdateColor() {
    runBulk("เปลี่ยนสีโซน", (tableId) =>
      fetch(`/api/admin/events/${id}/tables/${tableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zoneColor: bulkColor }),
      })
    );
  }

  function bulkDelete() {
    runBulk("ลบ", (tableId) => fetch(`/api/admin/events/${id}/tables/${tableId}`, { method: "DELETE" }));
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

      {selected.size > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-5 flex flex-wrap gap-4 items-end">
          <span className="text-sm font-medium text-primary-800 self-center">
            เลือกอยู่ {selected.size} โต๊ะ
          </span>
          <label className="flex flex-col text-sm gap-1 text-slate-600">
            เปลี่ยนชื่อโซนเป็น
            <div className="flex gap-2">
              <input
                value={bulkZone}
                onChange={(e) => setBulkZone(e.target.value)}
                placeholder="เช่น E1"
                className="border border-slate-300 rounded-lg px-2.5 py-1.5 w-28 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
              />
              <button
                disabled={bulkBusy}
                onClick={bulkUpdateZone}
                className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 transition-colors text-white rounded-lg px-3 py-1.5 text-sm font-medium shadow-sm shrink-0"
              >
                เปลี่ยนโซน
              </button>
            </div>
          </label>
          <label className="flex flex-col text-sm gap-1 text-slate-600">
            เปลี่ยนสีโซนเป็น
            <div className="flex gap-2">
              <input
                type="color"
                value={bulkColor}
                onChange={(e) => setBulkColor(e.target.value)}
                className="border border-slate-300 rounded-lg w-12 h-9 cursor-pointer"
              />
              <button
                disabled={bulkBusy}
                onClick={bulkUpdateColor}
                className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 transition-colors text-white rounded-lg px-3 py-1.5 text-sm font-medium shadow-sm shrink-0"
              >
                เปลี่ยนสี
              </button>
            </div>
          </label>
          <button
            disabled={bulkBusy}
            onClick={bulkDelete}
            className="text-red-600 hover:text-white hover:bg-red-600 disabled:opacity-50 rounded-lg px-3 py-2 text-sm font-medium transition-colors border border-red-200 hover:border-red-600"
          >
            ลบโต๊ะที่เลือก ({selected.size})
          </button>
          <button
            disabled={bulkBusy}
            onClick={() => setSelected(new Set())}
            className="text-slate-500 hover:text-slate-700 disabled:opacity-50 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          >
            ยกเลิกการเลือก
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full bg-white text-sm">
          <thead>
            <tr className="text-left bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wide">
              <th className="p-3 font-medium w-10">
                <input
                  type="checkbox"
                  checked={tables.length > 0 && selected.size === tables.length}
                  onChange={toggleSelectAll}
                  className="cursor-pointer"
                />
              </th>
              <th className="p-3 font-medium">โต๊ะ</th>
              <th className="p-3 font-medium">ความจุ</th>
              <th className="p-3 font-medium">จองแล้ว</th>
              <th className="p-3 font-medium">โซน</th>
              <th className="p-3 font-medium text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((t, i) => (
              <tr
                key={t.id}
                className={`border-b border-slate-100 last:border-b-0 ${
                  selected.has(t.id) ? "bg-primary-50/70" : i % 2 === 1 ? "bg-slate-50/50" : ""
                } hover:bg-primary-50/50 transition-colors`}
              >
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggleSelect(t.id)}
                    className="cursor-pointer"
                  />
                </td>
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
