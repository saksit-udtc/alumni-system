"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface SearchItem {
  id: string;
  title: string;
  subtitle: string;
  status?: string;
  href: string;
}
interface SearchGroup {
  key: string;
  label: string;
  href: string;
  items: SearchItem[];
  more: boolean;
}

const STATUS_STYLE: Record<string, string> = {
  "รอชำระเงิน": "bg-amber-50 text-amber-700 border-amber-200",
  "รอตรวจสอบสลิป": "bg-amber-50 text-amber-700 border-amber-200",
  "ยืนยันแล้ว": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "ปฏิเสธ": "bg-red-50 text-red-700 border-red-200",
  "หมดเวลา": "bg-stone-100 text-stone-500 border-stone-200",
};

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

/**
 * ช่องค้นหารวมบนแถบบนของหน้า admin — ค้นรหัสจอง/ชื่อ/เบอร์โทร/รหัสออเดอร์/เลขพัสดุ ตามสิทธิ์ของบทบาท
 * (ผลลัพธ์กรองที่ฝั่ง server ที่ /api/admin/search)
 *   - กด "/" หรือ Ctrl+K เพื่อโฟกัส, ลูกศรขึ้น/ลงเลือกผล, Enter เปิด, Esc ปิด
 *   - Enter โดยไม่ได้เลือกผลใด → ไปหน้ารายการของกลุ่มแรกพร้อมคำค้น
 */
export default function AdminGlobalSearch({
  autoFocus,
  onDone,
  className = "",
}: {
  /** เปลี่ยนเป็น true เมื่อเปิดช่องค้นหาบนมือถือ เพื่อโฟกัสอัตโนมัติ */
  autoFocus?: boolean;
  /** เรียกเมื่อเลือกผลลัพธ์/กด Esc (ให้แถบบนมือถือปิดโหมดค้นหา) */
  onDone?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqRef = useRef<AbortController | null>(null);

  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [groups, setGroups] = useState<SearchGroup[] | null>(null);
  const [active, setActive] = useState(-1);

  const flat = (groups || []).flatMap((g) => g.items);
  const term = value.trim();
  const tooShort = term.length < MIN_CHARS;

  const close = useCallback(() => {
    setOpen(false);
    setActive(-1);
  }, []);

  // ค้นหาแบบหน่วงเวลา (debounce) + ยกเลิกคำขอเก่าที่ยังค้างอยู่
  useEffect(() => {
    if (tooShort) {
      reqRef.current?.abort();
      setGroups(null);
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      reqRef.current?.abort();
      const ctrl = new AbortController();
      reqRef.current = ctrl;
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal, cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        setGroups(data.groups || []);
        setError(false);
        setActive(-1);
      } catch (e: any) {
        if (e?.name === "AbortError") return; // มีคำค้นใหม่แทนแล้ว
        setError(true);
        setGroups(null);
      } finally {
        if (reqRef.current === ctrl) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, tooShort]);

  // ทางลัดคีย์บอร์ด: "/" หรือ Ctrl/Cmd+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if ((e.key === "/" && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) {
        if (!inputRef.current || inputRef.current.offsetParent === null) return; // ช่องถูกซ่อนอยู่ (มือถือ)
        e.preventDefault();
        inputRef.current.focus();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // คลิกนอกกล่อง = ปิดรายการผลลัพธ์
  useEffect(() => {
    function onDown(e: MouseEvent | TouchEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [close]);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
      setOpen(true);
    }
  }, [autoFocus]);

  function go(href: string) {
    close();
    setValue("");
    setGroups(null);
    inputRef.current?.blur();
    router.push(href);
    onDone?.();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (open && term) {
        close();
      } else {
        inputRef.current?.blur();
        onDone?.();
      }
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (flat.length === 0) return;
      e.preventDefault();
      setOpen(true);
      setActive((i) => (e.key === "ArrowDown" ? (i + 1) % flat.length : i <= 0 ? flat.length - 1 : i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && flat[active]) go(flat[active].href);
      else if (groups && groups[0]) go(groups[0].href);
    }
  }

  let flatIndex = -1;

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="ค้นหารหัสจอง / ชื่อ / เบอร์โทร / รหัสออเดอร์"
          aria-label="ค้นหา"
          role="combobox"
          aria-expanded={open && !tooShort}
          aria-controls="admin-global-search-results"
          autoComplete="off"
          className="w-full h-10 rounded-lg border border-cream-200 bg-cream-50 pl-9 pr-10 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-colors [&::-webkit-search-cancel-button]:hidden"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              setValue("");
              inputRef.current?.focus();
            }}
            aria-label="ล้างคำค้นหา"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-4 h-4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        ) : (
          <kbd className="hidden md:block absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] leading-none text-stone-400 border border-cream-200 bg-white rounded px-1.5 py-1 pointer-events-none">
            /
          </kbd>
        )}
      </div>

      {open && term.length > 0 && (
        <div
          id="admin-global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 z-50 bg-white rounded-xl border border-cream-200 shadow-xl max-h-[70vh] overflow-y-auto"
        >
          {tooShort ? (
            <p className="px-4 py-3 text-sm text-stone-400">พิมพ์อย่างน้อย {MIN_CHARS} ตัวอักษร</p>
          ) : error ? (
            <p className="px-4 py-3 text-sm text-red-600">ค้นหาไม่สำเร็จ ลองใหม่อีกครั้ง</p>
          ) : loading && !groups ? (
            <p className="px-4 py-3 text-sm text-stone-400">กำลังค้นหา...</p>
          ) : groups && groups.length === 0 ? (
            <p className="px-4 py-3 text-sm text-stone-500">ไม่พบผลลัพธ์สำหรับ &quot;{term}&quot;</p>
          ) : (
            <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
              {(groups || []).map((g) => (
                <div key={g.key} className="py-1.5 border-b last:border-b-0 border-cream-100">
                  <div className="flex items-center justify-between px-4 pt-1.5 pb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">{g.label}</span>
                    {g.more && (
                      <Link
                        href={g.href}
                        onClick={(e) => {
                          e.preventDefault();
                          go(g.href);
                        }}
                        className="text-xs text-maroon-700 hover:underline"
                      >
                        ดูทั้งหมด
                      </Link>
                    )}
                  </div>
                  {g.items.map((it) => {
                    flatIndex += 1;
                    const idx = flatIndex;
                    return (
                      <Link
                        key={it.id}
                        href={it.href}
                        role="option"
                        aria-selected={active === idx}
                        onClick={(e) => {
                          e.preventDefault();
                          go(it.href);
                        }}
                        onMouseEnter={() => setActive(idx)}
                        className={`flex items-center justify-between gap-3 px-4 py-2 ${active === idx ? "bg-primary-50" : "hover:bg-cream-50"}`}
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-stone-800 truncate">{it.title}</span>
                          <span className="block text-xs text-stone-500 truncate">{it.subtitle}</span>
                        </span>
                        {it.status && (
                          <span
                            className={`shrink-0 text-[11px] px-2 py-0.5 rounded-lg border font-medium whitespace-nowrap ${
                              STATUS_STYLE[it.status] || "bg-stone-100 text-stone-500 border-stone-200"
                            }`}
                          >
                            {it.status}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
