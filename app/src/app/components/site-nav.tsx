"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const STATIC_NAV_LINKS = [
  { href: "/status", label: "เช็คสถานะการจองโต๊ะ" },
  { href: "/merch", label: "สั่งซื้อของที่ระลึก" },
  { href: "/merch/status", label: "เช็คสถานะการสั่งซื้อ" },
];

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" />
      ) : (
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </>
      )}
    </svg>
  );
}

export default function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [bookingHref, setBookingHref] = useState("/");

  // "จองโต๊ะงานเลี้ยง" jumps straight into the currently open event's
  // booking page instead of going through the homepage.
  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => {
        const events = data.events || [];
        const bookableEvent = events.find((e: any) => e.status === "open") || events[0];
        if (bookableEvent) setBookingHref(`/events/${bookableEvent.id}`);
      })
      .catch(() => {});
  }, []);

  const NAV_LINKS = [{ href: bookingHref, label: "จองโต๊ะงานเลี้ยง" }, ...STATIC_NAV_LINKS];

  function isActive(href: string) {
    // "/merch" is checked with an exact match (not startsWith) so it
    // doesn't also light up on "/merch/status", which has its own link.
    if (href === "/" || href === "/merch") return pathname === href;
    if (href.startsWith("/events/")) return pathname === href;
    return pathname?.startsWith(href);
  }

  return (
    <>
    {/* ฟอนต์เดียวกับหน้าแรก (หน้าแรกโหลดผ่าน @import ใน page.tsx) */}
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600&display=swap" />
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-cream-200">
      <div className="max-w-6xl mx-auto px-4 h-10 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          {/* โลโก้และชื่อเหมือนแถบเมนูหน้าแรก (.brand ใน app/page.tsx) */}
          <img src="/logo-89.png" alt="โลโก้ 89 ปี วิทยาลัยเทคนิคอุดรธานี" className="w-[30px] h-[30px] object-contain shrink-0" />
          <span
            className="font-semibold text-stone-800 text-[13px] tracking-[0.01em] truncate"
            style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }}
          >
            คืนสู่เหย้า วท.อุดรธานี
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-4 text-[13px]">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`transition-colors ${
                isActive(l.href) ? "text-maroon-700 font-semibold" : "text-stone-600 hover:text-maroon-700"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3 shrink-0">
          <Link
            href="/admin/login"
            className="text-xs font-medium bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-full px-3 py-1 shadow-sm"
          >
            สำหรับเจ้าหน้าที่
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
          aria-expanded={open}
          className="md:hidden p-1.5 -mr-1.5 text-stone-700 hover:text-maroon-700"
        >
          <MenuIcon open={open} />
        </button>
      </div>

      {open && (
        <nav className="md:hidden border-t border-cream-200 bg-white px-4 py-2 flex flex-col gap-0.5">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`px-2 py-2 rounded-lg text-[13px] transition-colors ${
                isActive(l.href) ? "bg-primary-50 text-maroon-700 font-semibold" : "text-stone-700 hover:bg-cream-50"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/admin/login"
            onClick={() => setOpen(false)}
            className="mt-1 text-center bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-lg px-3 py-2.5 text-sm font-medium"
          >
            สำหรับเจ้าหน้าที่
          </Link>
        </nav>
      )}
    </header>

      {/* ปุ่มลอย "หน้าแรก" — แสดงเฉพาะจอมือถือ (md:hidden) และทุกหน้าที่ไม่ใช่หน้าแรก */}
      {pathname !== "/" && (
        <Link
          href="/"
          aria-label="กลับหน้าแรก"
          className="md:hidden fixed right-4 bottom-4 z-40 inline-flex items-center gap-1.5 bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-full pl-3.5 pr-4 py-2.5 text-sm font-semibold shadow-lg"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11l9-8 9 8" />
            <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
          </svg>
          หน้าแรก
        </Link>
      )}
    </>
  );
}
