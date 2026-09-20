"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * ตัวช่วยค้นหาในหน้ารายการของ admin (ใช้ร่วมกับช่องค้นหารวมบนแถบบน)
 *  - UrlQuerySync   : อ่านพารามิเตอร์ใน URL (เช่น ?q=รหัส) แล้วส่งให้หน้า — ทำงานซ้ำเมื่อ URL เปลี่ยน
 *                     (เช่นกดผลค้นหารวมขณะอยู่หน้าเดียวกัน)
 *  - matchesQuery   : เช็คว่าแถวใดตรงกับคำค้น (ไม่สนตัวพิมพ์ใหญ่/เล็ก และเบอร์โทรไม่สนขีด/เว้นวรรค)
 *  - ListSearchInput: ช่องค้นหาหน้าตามาตรฐานเดียวกันทุกหน้า
 */

function ParamReader({ param, onValue }: { param: string; onValue: (v: string) => void }) {
  const sp = useSearchParams();
  const value = sp.get(param) ?? "";
  useEffect(() => {
    onValue(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return null;
}

// useSearchParams ต้องอยู่ใน Suspense ไม่เช่นนั้น next build จะ error ตอน prerender หน้า client
export function UrlQuerySync({ onQuery, param = "q" }: { onQuery: (v: string) => void; param?: string }) {
  return (
    <Suspense fallback={null}>
      <ParamReader param={param} onValue={onQuery} />
    </Suspense>
  );
}

export function matchesQuery(q: string, fields: unknown[]): boolean {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  const termDigits = term.replace(/[\s-]/g, "");
  return fields.some((f) => {
    if (f === null || f === undefined) return false;
    const s = String(f).toLowerCase();
    return s.includes(term) || (termDigits.length > 0 && s.replace(/[\s-]/g, "").includes(termDigits));
  });
}

export function ListSearchInput({
  value,
  onChange,
  placeholder,
  total,
  shown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  /** จำนวนทั้งหมด / ที่แสดง — ใส่ทั้งคู่เพื่อโชว์ "พบ x จาก y รายการ" ตอนกำลังค้นหา */
  total?: number;
  shown?: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full sm:w-96">
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
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full border border-stone-300 rounded-lg pl-9 pr-9 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="ล้างคำค้นหา"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-4 h-4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>
      {value.trim() && total !== undefined && shown !== undefined && (
        <span className="text-sm text-stone-500">
          พบ {shown.toLocaleString("th-TH")} จาก {total.toLocaleString("th-TH")} รายการ
        </span>
      )}
    </div>
  );
}
