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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold">รายการงาน</h1>
        <Link href="/admin/events/new" className="bg-primary-600 text-white rounded px-3 py-2 text-sm">
          + สร้างงานใหม่
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full bg-white rounded-xl shadow text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">ชื่องาน</th>
              <th className="p-2">วันที่</th>
              <th className="p-2">สถานะ</th>
              <th className="p-2">โต๊ะ</th>
              <th className="p-2">การจอง</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id} className="border-b">
                <td className="p-2">
                  <Link href={`/admin/events/${ev.id}`} className="text-primary-600 hover:underline">
                    {ev.name}
                  </Link>
                </td>
                <td className="p-2">{new Date(ev.eventDate).toLocaleDateString("th-TH")}</td>
                <td className="p-2">{STATUS_LABEL[ev.status]}</td>
                <td className="p-2">{ev._count?.tables ?? 0}</td>
                <td className="p-2">{ev._count?.reservations ?? 0}</td>
                <td className="p-2 flex flex-wrap gap-2">
                  <Link href={`/admin/events/${ev.id}/edit`} className="text-primary-600 hover:underline">
                    แก้ไข
                  </Link>
                  <button onClick={() => deleteEvent(ev.id)} className="text-red-500 hover:underline">
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
