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

/** การ์ดตัวเลข: พื้นสีตามสินค้า/โซน มีเอฟเฟกต์ตอนวางเมาส์ */
function Num({ title, sub, value, unit, of, money, tone }: { title: string; sub?: string; value: number; unit?: string; of?: number; money?: number; tone: Tone }) {
  return (
    <div className={`group rounded-2xl border px-3.5 py-3 sm:px-5 sm:py-4 transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg ${tone.card} ${tone.hover}`}>
      <div className="flex items-center gap-2 text-sm">
        <i className={`w-2 h-2 rounded-full shrink-0 transition-transform duration-200 group-hover:scale-150 ${tone.chip}`} />
        <span className="truncate font-medium text-slate-400">{title}{sub ? ` · ${sub}` : ""}</span>
      </div>
      <div className={`text-[clamp(1.875rem,2.6vw,2.75rem)] font-display font-bold tabular-nums leading-tight mt-2 sm:mt-3 ${tone.text}`}>
        {n(value)}
        {of !== undefined && <span className="text-[0.45em] font-normal text-slate-400"> / {n(of)}</span>}
      </div>
      <div className="text-sm font-semibold text-slate-500 mt-0.5">{unit ?? "\u00a0"}</div>
      {money !== undefined && (
        <div className="mt-3 pt-2 border-t border-slate-200 flex items-baseline justify-between text-sm">
          <span className="opacity-70">ยอดเงิน</span>
          <b className="tabular-nums">{n(money)} <span className="font-normal text-xs opacity-75">บาท</span></b>
        </div>
      )}
    </div>
  );
}

function EventTables({ e, showMoney }: { e: EventTableSummary; showMoney: boolean }) {
  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold text-slate-800">{e.eventName}</h3>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-500">รายละเอียดโต๊ะ</h4>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,150px),1fr))] gap-3">
          <Num title="โต๊ะทั้งหมด" value={e.tables.confirmed} of={e.totalTables} unit="โต๊ะ" money={showMoney ? e.revenue.confirmed : undefined} tone={TABLE_TONE} />
          <Num title="จองเต็มโต๊ะ" value={e.fullTableBookings.confirmed} unit="รายการ" tone={TABLE_TONE} />
          <Num title="จองรายที่นั่ง" value={e.seatBookings.confirmed} unit="รายการ" tone={TABLE_TONE} />
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-500">รายละเอียดแยกตามโซน</h4>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,150px),1fr))] gap-3">
          {e.zones.map((z, i) => (
            <Num key={z.zone} title={`โซน ${z.zone}`} value={z.confirmed} of={z.tables} unit="โต๊ะ" tone={PALETTE[i % PALETTE.length]} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SalesSummaryView({ apiUrl, exportUrl, title = "สรุปยอดสินค้าและโต๊ะ", showMoney = true }: { apiUrl: string; exportUrl?: string; title?: string; showMoney?: boolean }) {
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

  const groups: { name: string; rows: MerchRow[] }[] = [];
  for (const r of data?.merch ?? []) {
    const g = groups[groups.length - 1];
    if (g && g.name === r.productName) g.rows.push(r);
    else groups.push({ name: r.productName, rows: [r] });
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-display font-semibold text-slate-800">{title}</h1>
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
          <section className={`space-y-4 ${tab === "tables" ? "" : "hidden"} lg:block lg:rounded-3xl lg:border lg:border-slate-200/70 lg:bg-white/40 lg:p-5`}>
            <h2 className="text-lg font-semibold text-slate-800">การจองโต๊ะ</h2>
            {data.events.length === 0 && <p className="text-sm text-slate-500">ยังไม่มีงานเลี้ยง</p>}
            {data.events.map((e) => (
              <EventTables key={e.eventId} e={e} showMoney={showMoney} />
            ))}
          </section>

          <section className={`space-y-3 ${tab === "merch" ? "" : "hidden"} lg:block lg:rounded-3xl lg:border lg:border-slate-200/70 lg:bg-white/40 lg:p-5`}>
            <h2 className="text-lg font-semibold text-slate-800">ของที่ระลึก (จำนวนชิ้น)</h2>
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
                          <span className={`rounded-full border px-3 py-0.5 text-sm font-semibold ${tone.pill}`}>
                            รวม <b className="text-base tabular-nums">{n(total)}</b> ชิ้น
                          </span>
                        )}
                        {showMoney && (
                          <span className="rounded-full border border-[#f05a22]/40 bg-orange-50 text-[#f05a22] px-3 py-0.5 text-sm font-semibold">
                            <b className="text-base tabular-nums">{n(money)}</b> บาท
                          </span>
                        )}
                      </h3>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,150px),1fr))] gap-3">
                        {g.rows.map((r) => (
                          <Num key={`${g.name}|${r.size}`} title={hasSize ? `ไซซ์ ${r.size ?? "-"}` : g.name} value={r.confirmed} unit="ชิ้น" money={showMoney ? r.revenueConfirmed : undefined} tone={tone} />
                        ))}
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    {shirts.map(renderGroup)}
                    {combo.length > 0 && (
                      <div key="combo" className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,150px),1fr))] gap-3">
                        {combo.map(({ g, gi }) => (
                          <Num
                            key={g.name}
                            title={g.name}
                            value={g.rows.reduce((a, r) => a + r.confirmed, 0)}
                            unit="ชิ้น"
                            money={showMoney ? g.rows.reduce((a, r) => a + r.revenueConfirmed, 0) : undefined}
                            tone={PALETTE[gi % PALETTE.length]}
                          />
                        ))}
                      </div>
                    )}
                    {others.map(renderGroup)}
                  </>
                );
              })()}
            </div>
            <p className="text-xs text-stone-400">รวมการขายหน้างาน (POS) และของในแพ็กเกจจองโต๊ะที่ยืนยันแล้ว · ของในแพ็กเกจไม่มีราคาแยก จึงไม่รวมในยอดเงิน</p>
          </section>
          </div>
        </>
      )}
    </div>
  );
}
