"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

export interface NotificationItem {
  key: string;
  label: string;
  count: number;
  href: string;
  navHref?: string;
  tone: "normal" | "warn";
  inBadge: boolean;
}

interface NotificationData {
  items: NotificationItem[];
  total: number;
}

const POLL_MS = 60_000;

/**
 * ดึงงานค้างของบทบาทที่ล็อกอินอยู่ (/api/admin/notifications)
 * รีเฟรชทุก 60 วินาที (เฉพาะตอนแท็บเปิดอยู่), ตอนกลับมาที่แท็บ และเมื่อเปลี่ยนหน้า
 * ใช้ทั้งกระดิ่งบนแถบบนและป้ายตัวเลขข้างเมนู
 */
export function useAdminNotifications(enabled: boolean, pathname: string | null) {
  const [data, setData] = useState<NotificationData | null>(null);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData(await res.json());
      setUpdatedAt(new Date());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      return;
    }
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [enabled, load]);

  // เปลี่ยนหน้า (เช่นเพิ่งอนุมัติสลิปแล้วกลับมา) → ตัวเลขอัปเดตทันที
  useEffect(() => {
    if (enabled) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ตัวเลขป้ายข้างเมนู: รวมจำนวนของรายการที่ชี้ไปเมนูเดียวกัน
  const navBadges: Record<string, number> = {};
  for (const it of data?.items || []) {
    if (it.navHref) navBadges[it.navHref] = (navBadges[it.navHref] || 0) + it.count;
  }

  return { data, error, updatedAt, reload: load, navBadges };
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export function NotificationBell({
  data,
  error,
  updatedAt,
  onReload,
}: {
  data: NotificationData | null;
  error: boolean;
  updatedAt: Date | null;
  onReload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const total = data?.total ?? 0;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) onReload();
        }}
        aria-label={total > 0 ? `งานที่รอดำเนินการ ${total} รายการ` : "งานที่รอดำเนินการ"}
        aria-expanded={open}
        className="relative w-10 h-10 flex items-center justify-center rounded-lg text-stone-600 hover:bg-cream-50 hover:text-maroon-700 transition-colors"
      >
        <BellIcon />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-rose-600 text-white text-[10px] leading-[1.1rem] font-semibold text-center ring-2 ring-white">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 max-w-[calc(100vw-1.5rem)] bg-white rounded-xl border border-cream-200 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-cream-100">
            <span className="text-sm font-semibold text-stone-800">งานที่รอดำเนินการ</span>
            <button type="button" onClick={onReload} className="text-xs text-maroon-700 hover:underline">
              รีเฟรช
            </button>
          </div>

          {error && !data ? (
            <p className="px-4 py-5 text-sm text-red-600">โหลดไม่สำเร็จ ลองรีเฟรชอีกครั้ง</p>
          ) : !data ? (
            <p className="px-4 py-5 text-sm text-stone-400">กำลังโหลด...</p>
          ) : data.items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-stone-500 text-center">ไม่มีงานค้างในตอนนี้</p>
          ) : (
            <ul className="py-1 max-h-[60vh] overflow-y-auto">
              {data.items.map((it) => (
                <li key={it.key}>
                  <Link
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-cream-50 transition-colors"
                  >
                    <span className={`text-sm ${it.tone === "warn" ? "text-amber-800" : "text-stone-700"}`}>
                      {it.tone === "warn" && <span aria-hidden="true">⚠ </span>}
                      {it.label}
                    </span>
                    <span
                      className={`shrink-0 min-w-[1.5rem] text-center text-xs font-semibold px-2 py-0.5 rounded-full ${
                        it.tone === "warn" ? "bg-amber-100 text-amber-800" : "bg-maroon-50 text-maroon-700"
                      }`}
                    >
                      {it.count.toLocaleString("th-TH")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {updatedAt && (
            <div className="px-4 py-2 border-t border-cream-100 text-[11px] text-stone-400">
              อัปเดตล่าสุด {updatedAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
              {error && <span className="text-red-500"> · รีเฟรชล่าสุดไม่สำเร็จ</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
