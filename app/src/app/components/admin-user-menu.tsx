"use client";

import { useEffect, useRef, useState } from "react";

/**
 * ชื่อผู้ใช้ + บทบาท มุมขวาบน — เห็นทันทีว่าตอนนี้ล็อกอินเป็นใคร (สำคัญเมื่อหลายคนใช้เครื่องร่วมกัน
 * หรือกำลังใช้ "มุมมองทดสอบ") พร้อมปุ่มออกจากระบบ
 */
export default function AdminUserMenu({
  username,
  roleLabel,
  impersonating,
  onLogout,
}: {
  username: string | null;
  roleLabel: string;
  impersonating: boolean;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

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

  const name = username || "ผู้ใช้งาน";
  const initial = (username || "?").trim().charAt(0).toUpperCase();

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`บัญชีผู้ใช้ ${name} (${roleLabel})`}
        className="flex items-center gap-2.5 h-10 pl-1 pr-2 sm:pr-3 rounded-lg hover:bg-cream-50 transition-colors"
      >
        <span
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold bg-maroon-700 text-white ${
            impersonating ? "ring-2 ring-amber-400 ring-offset-1" : ""
          }`}
          aria-hidden="true"
        >
          {initial}
        </span>
        <span className="hidden sm:block text-left leading-tight max-w-[11rem]">
          <span className="block text-sm font-medium text-stone-800 truncate">{name}</span>
          <span className="block text-[11px] text-stone-500 truncate">
            {roleLabel}
            {impersonating ? " (ทดสอบ)" : ""}
          </span>
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 max-w-[calc(100vw-1.5rem)] bg-white rounded-xl border border-cream-200 shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-cream-100">
            <div className="text-sm font-semibold text-stone-800 truncate">{name}</div>
            <div className="text-xs text-stone-500 mt-0.5">
              {roleLabel}
              {impersonating ? " · โหมดทดสอบ (View as)" : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-stone-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            ออกจากระบบ
          </button>
        </div>
      )}
    </div>
  );
}
