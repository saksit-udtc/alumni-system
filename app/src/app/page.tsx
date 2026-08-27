"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteNav from "./components/site-nav";

interface EventItem {
  id: string;
  name: string;
  eventDate: string;
  location: string | null;
  status: "draft" | "open" | "closed";
  pricePerTable: string;
  pricePerSeat: string;
}

const FEATURES = [
  { icon: "clock", label: "จองออนไลน์ได้ตลอด 24 ชม." },
  { icon: "qr", label: "ยืนยันตัวตนด้วย QR Code" },
  { icon: "map", label: "เลือกโซนที่นั่งบนผังงานจริง" },
  { icon: "bell", label: "แจ้งเตือนสถานะอัตโนมัติ" },
];

function FeatureIcon({ name }: { name: string }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "clock") return <svg {...common} className="w-5 h-5"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>;
  if (name === "qr") return <svg {...common} className="w-5 h-5"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v3M17 20h3" /></svg>;
  if (name === "map") return <svg {...common} className="w-5 h-5"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>;
  return <svg {...common} className="w-5 h-5"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>;
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
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
    <div>
      <SiteNav />

      <section className="relative overflow-hidden bg-maroon-700">
        <div className="relative max-w-6xl mx-auto px-4 py-16 sm:py-20 text-center">
          <span className="inline-block text-xs font-medium tracking-wide uppercase bg-white/10 text-primary-200 rounded-full px-3 py-1 mb-5 border border-primary-400/30">
            ระบบจองโต๊ะออนไลน์
          </span>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold text-white leading-snug">
            งานคืนสู่เหย้า <span className="text-primary-300">ศิษย์เก่าวิทยาลัย</span>
          </h1>
          <p className="mt-4 text-cream-50/80 max-w-xl mx-auto">
            จองโต๊ะร่วมงาน ตรวจสอบสถานะ และสั่งซื้อของที่ระลึก ได้ในที่เดียว
          </p>
        </div>

        <div className="relative border-t border-white/10 bg-black/10">
          <div className="max-w-6xl mx-auto px-4 py-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {FEATURES.map((f) => (
              <div key={f.label} className="flex items-center gap-2.5 text-cream-50/90 justify-center sm:justify-start">
                <span className="text-primary-300">
                  <FeatureIcon name={f.icon} />
                </span>
                <span className="text-xs sm:text-sm">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main id="events" className="max-w-6xl mx-auto px-4 py-12 scroll-mt-16">
        <div className="text-center mb-8">
          <span className="text-xs font-medium tracking-wide uppercase text-maroon-700">งานที่เปิดให้จอง</span>
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-stone-800 mt-1">เลือกงานที่ต้องการเข้าร่วม</h2>
        </div>

        {loading && <p className="text-stone-500 text-center">กำลังโหลด...</p>}
        {!loading && events.length === 0 && (
          <p className="text-stone-500 text-center">ยังไม่มีงานที่เปิดให้จอง</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map((ev) => {
            const d = new Date(ev.eventDate);
            return (
              <Link
                key={ev.id}
                href={`/events/${ev.id}`}
                className="group flex flex-col bg-white rounded-2xl border border-cream-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden"
              >
                <div className="relative bg-maroon-700 px-5 py-5 flex items-center justify-between">
                  <div className="text-white">
                    <div className="text-2xl font-display font-semibold leading-none">
                      {d.toLocaleDateString("th-TH", { day: "numeric" })}
                    </div>
                    <div className="text-xs text-cream-50/80 mt-1">
                      {d.toLocaleDateString("th-TH", { month: "short", year: "numeric" })}
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      ev.status === "open" ? "bg-emerald-100 text-emerald-700" : "bg-white/20 text-white"
                    }`}
                  >
                    {ev.status === "open" ? "เปิดจอง" : "ปิดรับจอง"}
                  </span>
                </div>

                <div className="p-5 flex flex-col gap-2 flex-1">
                  <h3 className="font-display font-semibold text-stone-800 group-hover:text-maroon-700 transition-colors">
                    {ev.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-sm text-stone-500">
                    <CalendarIcon />
                    {d.toLocaleDateString("th-TH", { dateStyle: "long" })}
                  </div>
                  {ev.location && (
                    <div className="flex items-center gap-1.5 text-sm text-stone-500">
                      <PinIcon />
                      {ev.location}
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-cream-200 text-sm font-medium text-primary-700 group-hover:text-maroon-700 transition-colors flex items-center justify-between">
                    ดูรายละเอียด & จองโต๊ะ
                    <span aria-hidden="true" className="group-hover:translate-x-0.5 transition-transform">→</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
