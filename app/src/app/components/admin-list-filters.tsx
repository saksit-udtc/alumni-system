"use client";

import { useState } from "react";

/**
 * ตัวกรองสำหรับหน้ารายการของ admin (รายการจอง / คำสั่งซื้อของที่ระลึก / ลงทะเบียนศิษย์เก่าดีเด่น-ผู้สนับสนุน)
 *  - useListFilters       : state ของตัวกรอง (สถานะ / สลิป / วันที่)
 *  - matchesListFilters   : เช็คว่าแถวหนึ่งผ่านตัวกรองทั้งหมดหรือไม่ — กรองฝั่ง client จากข้อมูลที่โหลดมาแล้ว
 *  - AdminFilterBar       : แถบตัวกรองหน้าตามาตรฐานเดียวกันทุกหน้า
 *  ใช้ร่วมกับช่องค้นหา (ListSearchInput) ได้ — ตัวกรองทุกตัวทำงานแบบ AND
 */

/* ---------- สถานะสลิป (ผลตรวจอัตโนมัติจาก EasySlip) ---------- */

export type SlipCategory = "none" | "match" | "error" | "suspicious" | "unchecked";
export type SlipFilter = "all" | SlipCategory;

export const SLIP_LABEL: Record<SlipCategory, string> = {
  none: "ไม่มีสลิป",
  match: "✓ ตรงกับธนาคาร",
  error: "ตรวจสอบไม่สำเร็จ",
  suspicious: "⚠ ไม่ตรง/น่าสงสัย",
  unchecked: "ยังไม่ได้ตรวจอัตโนมัติ",
};
const SLIP_ORDER: SlipCategory[] = ["none", "match", "error", "suspicious", "unchecked"];

/** แปลง (มีสลิปไหม, easyslipStatus) เป็นหมวดเดียวกับที่ badge บนหน้ารายการแสดง */
export function slipCategory(hasSlip: boolean, easyslipStatus: string | null | undefined): SlipCategory {
  if (!hasSlip) return "none";
  if (!easyslipStatus || easyslipStatus === "SKIPPED") return "unchecked";
  if (easyslipStatus === "MATCH") return "match";
  if (easyslipStatus === "ERROR") return "error";
  return "suspicious"; // AMOUNT_MISMATCH, INVALID_SLIP, DUPLICATE ฯลฯ
}

export function countSlipCategories(items: { slip: SlipCategory }[]): Record<SlipCategory, number> {
  const counts: Record<SlipCategory, number> = { none: 0, match: 0, error: 0, suspicious: 0, unchecked: 0 };
  for (const it of items) counts[it.slip] += 1;
  return counts;
}

/* ---------- ช่วงวันที่ ---------- */

export type DatePreset = "all" | "today" | "custom";
export interface DateRangeValue {
  preset: DatePreset;
  /** YYYY-MM-DD (เวลาท้องถิ่นของเบราว์เซอร์) — ใช้เมื่อ preset = custom */
  from: string;
  to: string;
}
export const EMPTY_DATE_RANGE: DateRangeValue = { preset: "all", from: "", to: "" };

function parseLocalDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** วันที่ของแถวอยู่ในช่วงที่เลือกไหม — ใช้เวลาท้องถิ่น (วันนี้ = ตั้งแต่ 00:00 ของวันนี้) */
export function inDateRange(range: DateRangeValue, value: string | Date | null | undefined, now: Date = new Date()): boolean {
  if (range.preset === "all") return true;
  if (!value) return false;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return false;
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  if (range.preset === "today") {
    return t >= new Date(y, m, d).getTime() && t < new Date(y, m, d + 1).getTime();
  }
  const from = parseLocalDate(range.from);
  const to = parseLocalDate(range.to);
  if (from && t < from.getTime()) return false;
  if (to && t >= new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1).getTime()) return false;
  return true;
}

/* ---------- state + การกรอง ---------- */

export interface ListFilters {
  status: string; // "all" หรือค่า paymentStatus
  slip: SlipFilter;
  date: DateRangeValue;
  setStatus: (v: string) => void;
  setSlip: (v: SlipFilter) => void;
  setDate: (v: DateRangeValue) => void;
  clear: () => void;
  hasActive: boolean;
}

export function useListFilters(): ListFilters {
  const [status, setStatus] = useState("all");
  const [slip, setSlip] = useState<SlipFilter>("all");
  const [date, setDate] = useState<DateRangeValue>(EMPTY_DATE_RANGE);

  const clear = () => {
    setStatus("all");
    setSlip("all");
    setDate(EMPTY_DATE_RANGE);
  };
  const hasActive = status !== "all" || slip !== "all" || date.preset !== "all";

  return { status, slip, date, setStatus, setSlip, setDate, clear, hasActive };
}

export interface FilterableRow {
  status: string;
  slip: SlipCategory;
  createdAt: string | Date | null | undefined;
}

export function matchesListFilters(f: ListFilters, row: FilterableRow): boolean {
  if (f.status !== "all" && row.status !== f.status) return false;
  if (f.slip !== "all" && row.slip !== f.slip) return false;
  return inDateRange(f.date, row.createdAt);
}

/* ---------- ตัวเลือกสถานะ (มีจำนวนต่อท้าย) ---------- */

const STATUS_ORDER = ["awaiting_verify", "pending", "confirmed", "rejected", "expired"];

export function buildStatusOptions(statuses: string[], labels: Record<string, string>) {
  const counts = new Map<string, number>();
  for (const s of statuses) counts.set(s, (counts.get(s) || 0) + 1);
  const known = STATUS_ORDER.filter((s) => counts.has(s));
  const other = Array.from(counts.keys()).filter((s) => !STATUS_ORDER.includes(s));
  return [...known, ...other].map((value) => ({ value, label: labels[value] || value, count: counts.get(value) || 0 }));
}

/* ---------- UI ---------- */

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "today", label: "วันนี้" },
  { key: "custom", label: "กำหนดเอง" },
];

const SELECT_CLASS =
  "border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white text-stone-700 min-w-[10rem] focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow";
const DATE_INPUT_CLASS =
  "border border-stone-300 rounded-lg px-2.5 py-2 text-sm bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-stone-500">{label}</span>
      {children}
    </label>
  );
}

export function AdminFilterBar({
  filters,
  statusOptions,
  totalAll,
  slipCounts,
  dateLabel,
  shown,
  total,
  search,
}: {
  filters: ListFilters;
  statusOptions: { value: string; label: string; count: number }[];
  /** จำนวนแถวทั้งหมด (ก่อนกรอง) — แสดงต่อท้ายตัวเลือก "ทั้งหมด" */
  totalAll: number;
  slipCounts: Record<SlipCategory, number>;
  /** ชื่อของวันที่ที่ใช้กรอง เช่น "วันที่จอง" */
  dateLabel: string;
  shown: number;
  total: number;
  /** ช่องค้นหาที่อยู่แถวเดียวกับตัวกรอง (ใช้ร่วมกับ UrlQuerySync เดิมได้ — ?q= จากช่องค้นหารวมบนแถบบนยังใช้งานได้) */
  search?: { value: string; onChange: (v: string) => void; placeholder: string };
}) {
  const f = filters;
  const custom = f.date.preset === "custom";
  const searchText = search?.value.trim() || "";
  const canClear = f.hasActive || !!searchText;
  const showCount = canClear;
  const slipOptions = SLIP_ORDER.filter((c) => slipCounts[c] > 0 || f.slip === c);
  // ตัวเลือกสถานะที่เลือกอยู่ต้องมีอยู่ในรายการเสมอ (กันกรณีข้อมูลเปลี่ยนหลังโหลดใหม่)
  const statusHasSelected = f.status === "all" || statusOptions.some((o) => o.value === f.status);

  return (
    <div className="bg-white rounded-2xl border border-cream-200/80 shadow-sm p-4">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        {search && (
          <div className="flex flex-col gap-1 w-full sm:w-72">
            <span className="text-xs text-stone-500">ค้นหา</span>
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
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder}
                aria-label={search.placeholder}
                className="w-full border border-stone-300 rounded-lg pl-9 pr-9 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow"
              />
              {search.value && (
                <button
                  type="button"
                  onClick={() => search.onChange("")}
                  aria-label="ล้างคำค้นหา"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-4 h-4">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        <Field label="สถานะ">
          <select value={f.status} onChange={(e) => f.setStatus(e.target.value)} className={SELECT_CLASS}>
            <option value="all">ทั้งหมด ({totalAll})</option>
            {!statusHasSelected && <option value={f.status}>{f.status}</option>}
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} ({o.count})
              </option>
            ))}
          </select>
        </Field>

        <Field label="สลิป">
          <select value={f.slip} onChange={(e) => f.setSlip(e.target.value as SlipFilter)} className={SELECT_CLASS}>
            <option value="all">ทั้งหมด</option>
            {slipOptions.map((c) => (
              <option key={c} value={c}>
                {SLIP_LABEL[c]} ({slipCounts[c]})
              </option>
            ))}
          </select>
        </Field>

        <Field label={dateLabel}>
          <select
            value={f.date.preset}
            onChange={(e) => {
              const preset = e.target.value as DatePreset;
              f.setDate(preset === "custom" ? { ...f.date, preset } : { preset, from: "", to: "" });
            }}
            className={SELECT_CLASS}
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>

        {custom && (
          <>
            <Field label="ตั้งแต่วันที่">
              <input
                type="date"
                value={f.date.from}
                max={f.date.to || undefined}
                onChange={(e) => f.setDate({ ...f.date, from: e.target.value })}
                className={DATE_INPUT_CLASS}
              />
            </Field>
            <Field label="ถึงวันที่">
              <input
                type="date"
                value={f.date.to}
                min={f.date.from || undefined}
                onChange={(e) => f.setDate({ ...f.date, to: e.target.value })}
                className={DATE_INPUT_CLASS}
              />
            </Field>
          </>
        )}

        {canClear && (
          <button
            type="button"
            onClick={() => {
              f.clear();
              search?.onChange("");
            }}
            className="text-sm px-3 py-2 rounded-lg border border-stone-300 text-stone-600 bg-white hover:bg-stone-50"
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>

      {showCount && (
        <p className="text-sm text-stone-500 mt-3">
          แสดง {shown.toLocaleString("th-TH")} จาก {total.toLocaleString("th-TH")} รายการ
        </p>
      )}
    </div>
  );
}
