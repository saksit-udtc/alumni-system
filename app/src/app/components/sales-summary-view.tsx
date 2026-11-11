"use client";

import { useEffect, useState } from "react";
import type { SalesSummary, EventTableSummary, MerchRow } from "@/lib/salesSummary";

const n = (v: number) => v.toLocaleString("th-TH");

// ชุดสีตามโทนหน้า Landing 89 ปี: ชมพู / น้ำเงิน / ม่วง / ส้ม (การ์ดพื้นขาว ตัวเลขสีเข้ม)
const mk = (num: string, dot: string, hover: string, pill: string) => ({
  card: "bg-white border-slate-200/70 text-slate-600 shadow-sm",
  text: num,
  chip: dot,
  hover,
  pill,
});
const PALETTE = [
  mk("text-[#d6407f]", "bg-[#d6407f]", "hover:border-[#d6407f] hover:shadow-pink-200", "border-[#d6407f]/40 bg-pink-50 text-[#d6407f]"),
  mk("text-[#2a6ab0]", "bg-[#2a6ab0]", "hover:border-[#2a6ab0] hover:shadow-blue-200", "border-[#2a6ab0]/40 bg-blue-50 text-[#2a6ab0]"),
  mk("text-[#9b4bb5]", "bg-[#9b4bb5]", "hover:border-[#9b4bb5] hover:shadow-purple-200", "border-[#9b4bb5]/40 bg-purple-50 text-[#9b4bb5]"),
  mk("text-[#f05a22]", "bg-[#f05a22]", "hover:border-[#f05a22] hover:shadow-orange-200", "border-[#f05a22]/40 bg-orange-50 text-[#f05a22]"),
];
const TABLE_TONE = mk("text-[#f05a22]", "bg-[#f05a22]", "hover:border-[#f05a22] hover:shadow-orange-200", "border-[#f05a22]/40 bg-orange-50 text-[#f05a22]");

type Tone = { card: string; text: string; chip: string; hover: string; pill: string };

/** การ์ดตัวเลข: หัวการ์ด (จุดสี + ชื่อ) → ตัวเลขหลัก + หน่วย → แถบท้ายการ์ด "คงเหลือ" (ทุกใบสูงเท่ากัน เรียงตรงกัน) */
function Num({ title, sub, value, unit, of, money, tone, compact, remaining, caption, big }: { title: string; sub?: string; value: number; unit?: string; of?: number; money?: number; tone: Tone; compact?: boolean; remaining?: number | null; caption?: string; big?: boolean }) {
  return (
    <div className={`group flex h-full flex-col rounded-2xl border ${compact ? "px-3 py-2.5" : "px-3.5 py-3 sm:px-5 sm:py-4"} transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg ${tone.card} ${tone.hover}`}>
      <div className={`flex items-center gap-2 ${compact ? "text-xs" : "text-sm"}`}>
        <i className={`w-2 h-2 rounded-full shrink-0 transition-transform duration-200 group-hover:scale-150 ${tone.chip}`} />
        <span className="truncate font-medium text-slate-500">{title}{sub ? ` · ${sub}` : ""}</span>
      </div>
      {(() => {
        const inline = !!caption; // การ์ดโซน/ของที่ระลึก: caption ซ้าย · ตัวเลข/หน่วย ชิดขวา บรรทัดเดียวกัน
        const cap = caption ? <span className={`shrink-0 whitespace-nowrap font-medium text-slate-500 ${compact ? "text-xs" : "text-sm"}`}>{caption}</span> : null;
        return (
          <>
            {!inline && cap && <div className={compact ? "mt-1.5" : "mt-2 sm:mt-3"}>{cap}</div>}
            <div className={`flex flex-nowrap items-baseline gap-1.5 ${inline ? "justify-between mt-2" : caption ? "mt-0.5" : compact ? "mt-1.5" : "mt-2 sm:mt-3"}`}>
              {inline && cap}
              <span className="flex shrink-0 items-baseline gap-1 whitespace-nowrap">
                <span className={`${big ? "text-[clamp(2.75rem,4.5vw,4rem)]" : compact ? "text-[clamp(1.25rem,1.5vw,1.625rem)]" : "text-[clamp(1.875rem,2.6vw,2.75rem)]"} font-display font-bold tabular-nums leading-none ${caption ? "text-[#ef4423]" : tone.text}`}>{n(value)}</span>
                {of !== undefined && <span className={`${big ? "text-[clamp(1.25rem,2vw,1.875rem)] font-semibold" : "text-xs"} font-bold tabular-nums`}><span className="text-slate-700">/ </span><span className="text-emerald-600">{n(of)}</span></span>}
                <span className={`font-semibold text-slate-700 ${big ? "text-[clamp(1rem,1.5vw,1.375rem)]" : compact ? "text-xs" : "text-sm"}`}>{unit ?? ""}</span>
              </span>
            </div>
          </>
        );
      })()}
      <div className="mt-auto">
        {money !== undefined && (
          <div className="mt-2 pt-2 border-t border-slate-200 flex items-baseline justify-between text-sm">
            <span className="opacity-70">ยอดเงิน</span>
            <b className="tabular-nums">{n(money)} <span className="font-normal text-xs opacity-75">บาท</span></b>
          </div>
        )}
      </div>
    </div>
  );
}

function EventTables({ e, showMoney, compact }: { e: EventTableSummary; showMoney: boolean; compact?: boolean }) {
  return (
    <div className="space-y-5">
      {!compact && <h3 className="text-base font-semibold text-slate-800">{e.eventName}</h3>}

      <div className="space-y-2">
        {!compact && <h4 className="text-sm font-semibold text-slate-500">รายละเอียดโต๊ะ</h4>}
        {/* การ์ดรวมทั้งงาน: โครงเดียวกับการ์ดโซน (จองแล้ว ซ้าย · ตัวเลข/ทั้งหมด ขวา · คงเหลือ ท้ายการ์ด) แต่ขนาดใหญ่กว่า */}
        <div className="w-full">
          <Num title="โต๊ะทั้งหมด" caption="จองแล้ว" value={e.tables.confirmed} of={e.totalTables} unit="โต๊ะ" money={showMoney ? e.revenue.confirmed : undefined} tone={TABLE_TONE} big />
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-500">รายละเอียดแยกตามโซน</h4>
        <div className={`grid gap-2 ${compact ? "grid-cols-[repeat(auto-fill,minmax(min(100%,120px),1fr))]" : "grid-cols-[repeat(auto-fill,minmax(min(100%,150px),1fr))] sm:gap-3"}`}>
          {e.zones.map((z, i) => (
            <Num key={z.zone} title={`โซน ${z.zone}`} value={z.confirmed} of={z.tables} unit="โต๊ะ" caption="จองแล้ว" tone={PALETTE[i % PALETTE.length]} compact={compact} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SalesSummaryView({ apiUrl, exportUrl, title = "สรุปยอดสินค้าและโต๊ะ", showMoney = true, headingAs = "h1", compact = false }: { apiUrl: string; exportUrl?: string; title?: string; showMoney?: boolean; headingAs?: "h1" | "h2"; compact?: boolean }) {
  const [data, setData] = useState<SalesSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"tables" | "merch">("tables");

  function load() {
    setLoading(true);
    fetch(apiUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch(() => setError("โหลดข้อมูลสรุปไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }
  useEffect(load, [apiUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = data?.merchTotals;
  const Heading = headingAs;

  const groups: { name: string; rows: MerchRow[] }[] = [];
  for (const r of data?.merch ?? []) {
    const g = groups[groups.length - 1];
    if (g && g.name === r.productName) g.rows.push(r);
    else groups.push({ name: r.productName, rows: [r] });
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-7"}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <Heading className={`font-display font-semibold text-slate-800 ${compact ? "text-lg" : "text-2xl"}`}>{title}</Heading>
          <p className="text-sm text-slate-500 mt-0.5">
            นับเฉพาะรายการที่ยืนยันสลิปแล้ว
            {data && ` · ข้อมูล ณ ${new Date(data.generatedAt).toLocaleString("th-TH")}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors disabled:opacity-50">
            {loading ? "กำลังโหลด…" : "รีเฟรช"}
          </button>
          {exportUrl && (
            <a href={exportUrl} className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors">
              Export Excel
            </a>
          )}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      {data && t && (
        <>
          <div role="tablist" className="lg:hidden flex gap-1 rounded-2xl bg-slate-100 p-1 w-full sm:w-fit">
            {([["tables", "การจองโต๊ะ"], ["merch", "ของที่ระลึก"]] as const).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`flex-1 sm:flex-none rounded-xl px-6 py-2.5 text-base font-semibold transition-all ${
                  tab === key ? "bg-white text-[#f05a22] shadow-sm ring-1 ring-[#f05a22]/30" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start">
          <div className={`space-y-4 ${tab === "tables" ? "" : "hidden"} lg:block ${compact ? "" : "lg:rounded-3xl lg:border lg:border-slate-200/70 lg:bg-white/40 lg:p-5"}`}>
            <h2 className="text-lg font-semibold text-slate-800">การจองโต๊ะ</h2>
            {data.events.length === 0 && <p className="text-sm text-slate-500">ยังไม่มีงานเลี้ยง</p>}
            {data.events.map((e) => (
              <EventTables key={e.eventId} e={e} showMoney={showMoney} compact={compact} />
            ))}
          </div>

          <div className={`space-y-3 ${tab === "merch" ? "" : "hidden"} lg:block ${compact ? "" : "lg:rounded-3xl lg:border lg:border-slate-200/70 lg:bg-white/40 lg:p-5"}`}>
            <h2 className="text-lg font-semibold text-slate-800">ของที่ระลึก{!compact && " (จำนวนชิ้น)"}</h2>
            {groups.length === 0 && <p className="text-sm text-slate-500">ยังไม่มีการสั่งซื้อ</p>}
            <div className="space-y-5">
              {(() => {
                const indexed = groups.map((g, gi) => ({ g, gi }));
                const isShirt = (name: string) => name.includes("เสื้อ");
                const isCombo = (name: string) => name.includes("เหรียญพระวิษณุ") || name.includes("แก้วน้ำ") || name.includes("แก้วเยติ");
                const shirts = indexed.filter(({ g }) => isShirt(g.name));
                const combo = indexed.filter(({ g }) => !isShirt(g.name) && isCombo(g.name));
                const others = indexed.filter(({ g }) => !isShirt(g.name) && !isCombo(g.name));

                const renderGroup = ({ g, gi }: { g: (typeof groups)[number]; gi: number }) => {
                  const tone = PALETTE[gi % PALETTE.length];
                  const hasSize = g.rows.some((r) => r.size);
                  const total = g.rows.reduce((a, r) => a + r.confirmed, 0);
                  const money = g.rows.reduce((a, r) => a + r.revenueConfirmed, 0);
                  return (
                    <div key={g.name} className="space-y-2">
                      <h3 className="flex flex-wrap items-center gap-x-3 gap-y-2 text-base font-semibold text-slate-800">
                        <span>{g.name}</span>
                        {isShirt(g.name) && (
                          <span className={`rounded-full border px-3 py-0.5 text-sm font-semibold border-[#ef4423]/40 bg-orange-50 text-[#ef4423]`}>
                            รวม <b className="text-base tabular-nums">{n(total)}</b> ตัว
                          </span>
                        )}
                        {showMoney && (
                          <span className="rounded-full border border-[#f05a22]/40 bg-orange-50 text-[#f05a22] px-3 py-0.5 text-sm font-semibold">
                            <b className="text-base tabular-nums">{n(money)}</b> บาท
                          </span>
                        )}
                      </h3>
                      <div className={`grid gap-2 ${compact ? "grid-cols-[repeat(auto-fill,minmax(min(100%,120px),1fr))]" : "grid-cols-[repeat(auto-fill,minmax(min(100%,150px),1fr))] sm:gap-3"}`}>
                        {g.rows.map((r) => (
                          <Num key={`${g.name}|${r.size}`} title={hasSize ? `ไซซ์ ${r.size ?? "-"}` : "จำนวนที่ขาย"} value={r.confirmed} unit={isShirt(g.name) ? "ตัว" : "ชิ้น"} caption="สั่งซื้อแล้ว" of={r.remaining != null ? r.remaining + r.total : undefined} money={showMoney ? r.revenueConfirmed : undefined} tone={tone} compact={compact} />
                        ))}
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    {shirts.map(renderGroup)}
                    {combo.map(renderGroup)}
                    {others.map(renderGroup)}
                  </>
                );
              })()}
            </div>
            {!compact && <p className="text-xs text-stone-400">รวมการขายหน้างาน (POS) และของในแพ็กเกจจองโต๊ะที่ยืนยันแล้ว · ของในแพ็กเกจไม่มีราคาแยก จึงไม่รวมในยอดเงิน</p>}
          </div>
          </div>
        </>
      )}
    </div>
  );
}
