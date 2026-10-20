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
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
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

  const NAV_LINKS = [{ href: "/", label: "หน้าแรก" }, { href: bookingHref, label: "จองโต๊ะงานเลี้ยง" }, ...STATIC_NAV_LINKS];

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
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" />
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-cream-200" style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }}>
      <div className="max-w-6xl mx-auto px-4 h-[52px] flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          {/* โลโก้และชื่อเหมือนแถบเมนูหน้าแรก (.brand ใน app/page.tsx) */}
          <img src="/logo-89.png" alt="โลโก้ 89 ปี วิทยาลัยเทคนิคอุดรธานี" className="w-[30px] h-[30px] object-contain shrink-0" />
          <span
            className="font-bold text-stone-900 text-[15px] tracking-[0.01em] truncate"
            style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }}
          >
            คืนสู่เหย้า วท.อุดรธานี
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-2 text-[15px]">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`transition-colors rounded-full border h-9 px-4 inline-flex items-center leading-none whitespace-nowrap font-semibold ${
                isActive(l.href)
                  ? "bg-[#f15a22] border-[#f15a22] text-white font-bold shadow-[0_3px_10px_rgba(241,90,34,0.35)]"
                  : "bg-white border-stone-200 text-stone-800 hover:border-[#f15a22] hover:text-[#f15a22] hover:bg-[#fff3ed]"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3 shrink-0">
          <Link
            href="/admin/login"
            className="h-9 px-4 inline-flex items-center leading-none whitespace-nowrap text-[15px] font-bold bg-[#9452b8] hover:bg-[#7f3fa3] transition-colors text-white rounded-full shadow-[0_4px_14px_rgba(148,82,184,0.45)]"
          >
            สำหรับเจ้าหน้าที่
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
          aria-expanded={open}
          className="lg:hidden p-1.5 -mr-1.5 text-stone-800 hover:text-maroon-700"
        >
          <MenuIcon open={open} />
        </button>
      </div>

      {open && (
        <nav className="lg:hidden border-t border-cream-200 bg-white px-4 py-2 flex flex-col gap-0.5">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`px-3 py-2.5 rounded-lg text-base font-semibold transition-colors ${
                isActive(l.href) ? "bg-[#f15a22] text-white font-bold" : "text-stone-800 hover:bg-[#fff3ed] hover:text-[#f15a22]"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/admin/login"
            onClick={() => setOpen(false)}
            className="mt-1 text-center bg-[#9452b8] hover:bg-[#7f3fa3] transition-colors text-white rounded-lg px-3 py-2.5 text-base font-bold shadow-[0_4px_14px_rgba(148,82,184,0.35)]"
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
