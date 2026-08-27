"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = { draft: "ร่าง", open: "เปิดจอง", closed: "ปิดรับจอง" };

export default function AdminEventsPage() {
  const [events, setEvents] = useState<any[]>([]);

  function load() {
    fetch("/api/admin/events").then((r) => r.json()).then((d) => setEvents(d.events || []));
  }

  useEffect(load, []);

  async function deleteEvent(id: string) {
    if (!confirm("ยืนยันลบงานนี้?")) return;
    await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
    load();
  }

  const statusBadge: Record<string, string> = {
    draft: "bg-stone-200 text-stone-600",
    open: "bg-emerald-100 text-emerald-700",
    closed: "bg-maroon-100 text-maroon-700",
  };

  const openCount = events.filter((e) => e.status === "open").length;
  const draftCount = events.filter((e) => e.status === "draft").length;
  const closedCount = events.filter((e) => e.status === "closed").length;
  const totalReservations = events.reduce((sum, e) => sum + (e._count?.reservations ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-display font-semibold text-stone-800">รายการงาน</h1>
          <p className="text-sm text-stone-500 mt-0.5">จัดการงานเลี้ยงคืนสู่เหย้าทั้งหมด</p>
        </div>
        <Link
          href="/admin/events/new"
          className="bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg px-4 py-2 text-sm font-medium shadow-sm"
        >
          + สร้างงานใหม่
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-cream-200 shadow-md p-4">
          <div className="text-xs text-stone-500">งานทั้งหมด</div>
          <div className="text-2xl font-display font-semibold text-stone-800 mt-1">{events.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-cream-200 shadow-md p-4">
          <div className="text-xs text-stone-500">เปิดจอง</div>
          <div className="text-2xl font-display font-semibold text-emerald-600 mt-1">{openCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-cream-200 shadow-md p-4">
          <div className="text-xs text-stone-500">ร่าง / ปิดรับจอง</div>
          <div className="text-2xl font-display font-semibold text-stone-600 mt-1">{draftCount + closedCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-cream-200 shadow-md p-4">
          <div className="text-xs text-stone-500">การจองรวม</div>
          <div className="text-2xl font-display font-semibold text-maroon-700 mt-1">{totalReservations}</div>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-cream-200 p-10 text-center">
          <p className="text-stone-500 mb-4">ยังไม่มีงานที่สร้างไว้ เริ่มสร้างงานเลี้ยงแรกของคุณได้เลย</p>
          <Link
            href="/admin/events/new"
            className="inline-block bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg px-4 py-2 text-sm font-medium shadow-sm"
          >
            + สร้างงานใหม่
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-cream-200 shadow-md">
          <table className="w-full bg-white text-sm">
            <thead>
              <tr className="text-left bg-cream-100 text-stone-500 text-xs uppercase tracking-wide">
                <th className="p-3 font-semibold">ชื่องาน</th>
                <th className="p-3 font-semibold">วันที่</th>
                <th className="p-3 font-semibold">สถานะ</th>
                <th className="p-3 font-semibold">โต๊ะ</th>
                <th className="p-3 font-semibold">การจอง</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-t border-cream-100 hover:bg-cream-50/60 transition-colors">
                  <td className="p-3">
                    <Link href={`/admin/events/${ev.id}`} className="text-maroon-700 hover:text-maroon-800 font-medium hover:underline">
                      {ev.name}
                    </Link>
                  </td>
                  <td className="p-3 text-stone-600">{new Date(ev.eventDate).toLocaleDateString("th-TH")}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusBadge[ev.status] || "bg-stone-200 text-stone-600"}`}>
                      {STATUS_LABEL[ev.status]}
                    </span>
                  </td>
                  <td className="p-3 text-stone-600">{ev._count?.tables ?? 0}</td>
                  <td className="p-3 text-stone-600">{ev._count?.reservations ?? 0}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-3">
                      <Link href={`/admin/events/${ev.id}/edit`} className="text-primary-700 hover:text-primary-800 hover:underline">
                        แก้ไข
                      </Link>
                      <button onClick={() => deleteEvent(ev.id)} className="text-red-600 hover:text-red-700 hover:underline">
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
