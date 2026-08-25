"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface EventItem {
  id: string;
  name: string;
  eventDate: string;
  location: string | null;
  status: "draft" | "open" | "closed";
  pricePerTable: string;
  pricePerSeat: string;
}

export default function HomePage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => setEvents(data.events || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="max-w-3xl mx-auto p-4">
      <header className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h1 className="text-2xl font-bold text-primary-700">🎓 งานคืนสู่เหย้า</h1>
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link href="/status" className="text-primary-600 hover:underline">
            ตรวจสอบการจอง
          </Link>
          <Link href="/admin/login" className="text-gray-500 hover:underline">
            สำหรับเจ้าหน้าที่
          </Link>
        </nav>
      </header>

      {loading && <p>กำลังโหลด...</p>}
      {!loading && events.length === 0 && <p className="text-gray-500">ยังไม่มีงานที่เปิดให้จอง</p>}

      <div className="flex flex-col gap-3">
        {events.map((ev) => (
          <Link
            key={ev.id}
            href={`/events/${ev.id}`}
            className="block bg-white rounded-xl shadow p-4 hover:shadow-md transition"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{ev.name}</h2>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  ev.status === "open" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
                }`}
              >
                {ev.status === "open" ? "เปิดจอง" : "ปิดรับจอง"}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              📅 {new Date(ev.eventDate).toLocaleDateString("th-TH", { dateStyle: "long" })}
            </p>
            {ev.location && <p className="text-sm text-gray-500">📍 {ev.location}</p>}
          </Link>
        ))}
      </div>
    </main>
  );
}
