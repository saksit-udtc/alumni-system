"use client";

import { useEffect, useState } from "react";
import type { SalesSummary, EventTableSummary, MerchRow } from "@/lib/salesSummary";

const n = (v: number) => v.toLocaleString("th-TH");

// ชุดสีต่อสินค้า (เขียนเป็นสตริงเต็มเพื่อให้ Tailwind มองเห็น)
const PALETTE = [
  { card: "bg-sky-50 border-sky-200 text-sky-900", text: "text-sky-700", chip: "bg-sky-500", hover: "hover:border-sky-400 hover:shadow-sky-200" },
  { card: "bg-violet-50 border-violet-200 text-violet-900", text: "text-violet-700", chip: "bg-violet-500", hover: "hover:border-violet-400 hover:shadow-violet-200" },
  { card: "bg-amber-50 border-amber-200 text-amber-900", text: "text-amber-700", chip: "bg-amber-500", hover: "hover:border-amber-400 hover:shadow-amber-200" },
  { card: "bg-rose-50 border-rose-200 text-rose-900", text: "text-rose-700", chip: "bg-rose-500", hover: "hover:border-rose-400 hover:shadow-rose-200" },
  { card: "bg-teal-50 border-teal-200 text-teal-900", text: "text-teal-700", chip: "bg-teal-500", hover: "hover:border-teal-400 hover:shadow-teal-200" },
  { card: "bg-indigo-50 border-indigo-200 text-indigo-900", text: "text-indigo-700", chip: "bg-indigo-500", hover: "hover:border-indigo-400 hover:shadow-indigo-200" },
  { card: "bg-orange-50 border-orange-200 text-orange-900", text: "text-orange-700", chip: "bg-orange-500", hover: "hover:border-orange-400 hover:shadow-orange-200" },
  { card: "bg-lime-50 border-lime-200 text-lime-900", text: "text-lime-700", chip: "bg-lime-600", hover: "hover:border-lime-400 hover:shadow-lime-200" },
];
const TABLE_TONE = { card: "bg-emerald-50 border-emerald-200 text-emerald-900", text: "text-emerald-700", chip: "bg-emerald-500", hover: "hover:border-emerald-400 hover:shadow-emerald-200" };

type Tone = { card: string; text: string; chip: string; hover: string };

/** การ์ดตัวเลข: พื้นสีตามสินค้า/โซน มีเอฟเฟกต์ตอนวางเมาส์ */
function Num({ title, sub, value, unit, of, money, tone }: { title: string; sub?: string; value: number; unit?: string; of?: number; money?: number; tone: Tone }) {
  return (
    <div className={`group rounded-2xl border px-5 py-4 transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg ${tone.card} ${tone.hover}`}>
      <div className="flex items-center gap-2 text-sm">
        <i className={`w-2 h-2 rounded-full shrink-0 transition-transform duration-200 group-hover:scale-150 ${tone.chip}`} />
        <span className="truncate opacity-80">{title}{sub ? ` · ${sub}` : ""}</span>
      </div>
      <div className="text-4xl font-bold tabular-nums leading-tight mt-2">
        {n(value)}
        {of !== undefined && <span className="text-lg font-normal opacity-50"> / {n(of)}</span>}
      </div>
      <div className="text-xs opacity-60 mt-0.5">{unit ?? "\u00a0"}</div>
      {money !== undefined && (
        <div className="mt-3 pt-2 border-t border-current/15 flex items-baseline justify-between text-sm">
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
      <h3 className="text-base font-semibold text-stone-800">{e.eventName}</h3>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-stone-500">รายละเอียดโต๊ะ</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Num title="โต๊ะทั้งหมด" value={e.tables.confirmed} of={e.totalTables} unit="โต๊ะ" money={showMoney ? e.revenue.confirmed : undefined} tone={TABLE_TONE} />
          <Num title="จองเต็มโต๊ะ" value={e.fullTableBookings.confirmed} unit="รายการ" tone={TABLE_TONE} />
          <Num title="จองรายที่นั่ง" value={e.seatBookings.confirmed} unit="รายการ" tone={TABLE_TONE} />
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-stone-500">รายละเอียดแยกตามโซน</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
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
          <h1 className="text-2xl font-display font-semibold text-stone-800">{title}</h1>
          <p className="text-sm text-stone-500 mt-0.5">
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
          <div role="tablist" className="flex gap-1 rounded-2xl bg-stone-100 p-1 w-full sm:w-fit">
            {([["tables", "การจองโต๊ะ"], ["merch", "ของที่ระลึก"]] as const).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`flex-1 sm:flex-none rounded-xl px-6 py-2.5 text-base font-semibold transition-all ${
                  tab === key ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "tables" && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-stone-800">การจองโต๊ะ</h2>
            {data.events.length === 0 && <p className="text-sm text-stone-500">ยังไม่มีงานเลี้ยง</p>}
            {data.events.map((e) => (
              <EventTables key={e.eventId} e={e} showMoney={showMoney} />
            ))}
          </section>
          )}

          {tab === "merch" && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-stone-800">ของที่ระลึก (จำนวนชิ้น)</h2>
            {groups.length === 0 && <p className="text-sm text-stone-500">ยังไม่มีการสั่งซื้อ</p>}
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
                      <h3 className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <i className={`w-4 h-4 rounded-full ${tone.chip}`} />
                        <span className={`text-2xl sm:text-3xl font-bold ${tone.text}`}>{g.name}</span>
                        {isShirt(g.name) && (
                          <span className={`rounded-full border px-3 py-1 text-lg sm:text-xl font-semibold ${tone.card}`}>
                            รวม <b className="text-2xl tabular-nums">{n(total)}</b> ชิ้น
                          </span>
                        )}
                        {showMoney && (
                          <span className="rounded-full border border-yellow-300 bg-yellow-50 text-yellow-900 px-3 py-1 text-lg sm:text-xl font-semibold">
                            <b className="text-2xl tabular-nums">{n(money)}</b> บาท
                          </span>
                        )}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
                      <div key="combo" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
          )}
        </>
      )}
    </div>
  );
}
