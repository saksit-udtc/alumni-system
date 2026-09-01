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

const TONE_CLASSES: Record<string, { icon: string; ring: string }> = {
  maroon: { icon: "bg-maroon-50 text-maroon-700", ring: "hover:ring-maroon-200" },
  primary: { icon: "bg-primary-50 text-primary-700", ring: "hover:ring-primary-200" },
  amber: { icon: "bg-amber-50 text-amber-600", ring: "hover:ring-amber-200" },
  emerald: { icon: "bg-emerald-50 text-emerald-600", ring: "hover:ring-emerald-200" },
};

function MenuIcon({ name }: { name: string }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "table")
    return (
      <svg {...common} className="w-6 h-6">
        <rect x="3" y="4" width="18" height="4" rx="1" />
        <path d="M5 8v11M19 8v11M9 8v11M15 8v11" />
      </svg>
    );
  if (name === "search")
    return (
      <svg {...common} className="w-6 h-6">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
    );
  if (name === "gift")
    return (
      <svg {...common} className="w-6 h-6">
        <rect x="3" y="8" width="18" height="4" rx="1" />
        <path d="M12 8v13M5 12v9h14v-9" />
        <path d="M12 8c-1.5 0-4-.8-4-3a2 2 0 0 1 4 0 2 2 0 0 1 4 0c0 2.2-2.5 3-4 3z" />
      </svg>
    );
  return (
    <svg {...common} className="w-6 h-6">
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 20c0-3.5 2.5-6 5.5-6s5.5 2.5 5.5 6" />
      <path d="M18 8v6M15 11h6" />
    </svg>
  );
}

export default function HomePage() {
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => setEvents(data.events || []));
  }, []);

  // "จองโต๊ะงานเลี้ยง" jumps straight into the currently open event's
  // booking page — the homepage no longer shows an events list at all, so
  // this fetch exists purely to resolve that one target.
  const bookableEvent = events.find((e) => e.status === "open") || events[0];

  const MENU_CARDS = [
    {
      href: bookableEvent ? `/events/${bookableEvent.id}` : undefined,
      icon: "table",
      title: "จองโต๊ะงานเลี้ยง",
      desc: "เลือกงานคืนสู่เหย้าที่เปิดจอง แล้วเลือกโต๊ะหรือที่นั่งที่ต้องการ",
      tone: "maroon",
    },
    {
      href: "/status",
      icon: "search",
      title: "ตรวจสอบการจอง",
      desc: "เช็คสถานะการจองโต๊ะ และคำสั่งซื้อของที่ระลึก",
      tone: "primary",
      secondary: { href: "/merch/status", label: "ตรวจสอบคำสั่งซื้อของที่ระลึก →" },
    },
    {
      href: "/merch",
      icon: "gift",
      title: "ซื้อของที่ระลึก",
      desc: "เลือกซื้อเสื้อ ของที่ระลึกงานคืนสู่เหย้า",
      tone: "amber",
    },
    {
      href: "/register",
      icon: "userPlus",
      title: "ลงทะเบียนศิษย์เก่า",
      desc: "เพิ่มชื่อเข้าทำเนียบศิษย์เก่า ไว้ติดต่อและรับข่าวสารรุ่น",
      tone: "emerald",
    },
  ];

  return (
    <div>
      {/* Old top nav bar removed — the 4 menu cards below are the site's
          navigation now. The staff entry point is kept, just tucked into
          the corner of the hero banner instead of a full nav item. */}
      <section className="relative overflow-hidden bg-maroon-700">
        <Link
          href="/admin/login"
          className="absolute top-4 right-4 sm:top-5 sm:right-6 z-10 text-xs sm:text-sm font-medium text-white/70 hover:text-white bg-white/10 hover:bg-white/20 transition-colors rounded-full px-3 py-1.5 border border-white/20"
        >
          สำหรับเจ้าหน้าที่
        </Link>

        <div className="relative max-w-6xl mx-auto px-4 pt-14 pb-20 sm:pt-16 sm:pb-24 text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-5">
            <img src="/logo-89.png" alt="ตราสัญลักษณ์ 89 ปี วิทยาลัยเทคนิคอุดรธานี" className="w-40 h-40 object-contain" />
          </Link>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold text-white leading-snug">
            งานคืนสู่เหย้า <span className="text-primary-300">ศิษย์เก่าวิทยาลัยเทคนิคอุดรธานี</span>
          </h1>
          <p className="mt-4 text-cream-50/80 max-w-xl mx-auto">
            จองโต๊ะร่วมงาน ตรวจสอบสถานะ และสั่งซื้อของที่ระลึก ได้ในที่เดียว
          </p>
        </div>
      </section>

      {/* 4 menu cards — the site's primary navigation, replacing both the
          old top nav bar and the events list that used to live below it. */}
      <section className="relative -mt-10 sm:-mt-12 z-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {MENU_CARDS.map((card) => {
              const tone = TONE_CLASSES[card.tone];
              return (
                <div
                  key={card.title}
                  className={`group bg-white rounded-2xl border border-cream-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all ring-1 ring-transparent ${tone.ring} flex flex-col`}
                >
                  <Link href={card.href ?? "#"} className="p-5 flex flex-col gap-3 flex-1">
                    <span className={`w-12 h-12 rounded-xl flex items-center justify-center ${tone.icon}`}>
                      <MenuIcon name={card.icon} />
                    </span>
                    <div>
                      <h3 className="font-display font-semibold text-stone-800 group-hover:text-maroon-700 transition-colors">
                        {card.title}
                      </h3>
                      <p className="text-sm text-stone-500 mt-1">{card.desc}</p>
                    </div>
                  </Link>
                  {card.secondary && (
                    <Link
                      href={card.secondary.href}
                      className="px-5 py-3 border-t border-cream-100 text-xs font-medium text-primary-700 hover:text-maroon-700 transition-colors"
                    >
                      {card.secondary.label}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="pb-16" />
    </div>
  );
}
