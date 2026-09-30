"use client";

import { useEffect, useState } from "react";
import { AdminStatCard } from "@/app/components/admin-stat-card";
import type { SalesSummary, EventTableSummary } from "@/lib/salesSummary";

const n = (v: number) => v.toLocaleString("th-TH");
const sum3 = (v: { confirmed: number; awaiting: number; pending: number }) => v.confirmed + v.awaiting + v.pending;

const TH = "px-3 py-2 text-xs font-semibold text-stone-500 whitespace-nowrap";
const TD = "px-3 py-2 text-sm tabular-nums text-right whitespace-nowrap";

function Cell({ v, tone }: { v: number; tone?: string }) {
  return <td className={`${TD} ${v === 0 ? "text-stone-300" : tone || "text-stone-700"}`}>{n(v)}</td>;
}

function EventBlock({ e }: { e: EventTableSummary }) {
  const booked = sum3(e.tables);
  const pct = e.totalTables ? Math.round((booked / e.totalTables) * 100) : 0;
  const confirmedPct = e.totalTables ? (e.tables.confirmed / e.totalTables) * 100 : 0;
  const waitingPct = e.totalTables ? ((e.tables.awaiting + e.tables.pending) / e.totalTables) * 100 : 0;
  const lines: [string, { confirmed: number; awaiting: number; pending: number }][] = [
    ["โต๊ะที่มีการจอง", e.tables],
    ["จองเต็มโต๊ะ (รายการ)", e.fullTableBookings],
    ["จองรายที่นั่ง (รายการ)", e.seatBookings],
    ["ที่นั่งที่ถูกจอง", e.seats],
  ];
  return (
    <div className="bg-white rounded-2xl border border-cream-200 shadow-sm p-5 space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-stone-800">{e.eventName}</h3>
        <span className="text-sm text-stone-500">
          จองแล้ว <b className="text-stone-800">{n(booked)}</b> / {n(e.totalTables)} โต๊ะ ({pct}%) · ว่าง {n(e.freeTables)} โต๊ะ
        </span>
      </div>
      <div className="h-3 rounded-full bg-stone-100 overflow-hidden flex" aria-label={`จองแล้ว ${pct}%`}>
        <div className="bg-emerald-500" style={{ width: `${confirmedPct}%` }} />
        <div className="bg-amber-400" style={{ width: `${waitingPct}%` }} />
      </div>
      <div className="flex gap-4 text-xs text-stone-500 -mt-3">
        <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />ยืนยันแล้ว</span>
        <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />รอตรวจสลิป/รอชำระ</span>
        <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-stone-200 inline-block" />ว่าง</span>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-cream-200">
              <tr>
                <th className={`${TH} text-left`}>รายการ</th>
                <th className={`${TH} text-right`}>ยืนยันแล้ว</th>
                <th className={`${TH} text-right`}>รอตรวจสลิป</th>
                <th className={`${TH} text-right`}>รอชำระ</th>
                <th className={`${TH} text-right`}>รวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {lines.map(([label, v]) => (
                <tr key={label}>
                  <td className="px-3 py-2 text-sm text-stone-700">{label}</td>
                  <Cell v={v.confirmed} tone="text-emerald-700" />
                  <Cell v={v.awaiting} tone="text-amber-700" />
                  <Cell v={v.pending} />
                  <td className={`${TD} font-semibold`}>{n(sum3(v))}</td>
                </tr>
              ))}
              <tr>
                <td className="px-3 py-2 text-sm text-stone-700">ยอดเงิน (บาท)</td>
                <Cell v={e.revenue.confirmed} tone="text-emerald-700" />
                <Cell v={e.revenue.awaiting} tone="text-amber-700" />
                <Cell v={e.revenue.pending} />
                <td className={`${TD} font-semibold`}>{n(sum3(e.revenue))}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-stone-400 mt-2 px-3">ที่นั่งทั้งหมด {n(e.totalSeats)} ที่ · โต๊ะที่มีหลายการจองนับตามสถานะที่ดีที่สุดของโต๊ะ</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-cream-200">
              <tr>
                <th className={`${TH} text-left`}>โซน</th>
                <th className={`${TH} text-right`}>ยืนยันแล้ว</th>
                <th className={`${TH} text-right`}>รอ</th>
                <th className={`${TH} text-right`}>ว่าง</th>
                <th className={`${TH} text-right`}>ทั้งหมด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {e.zones.map((z) => (
                <tr key={z.zone}>
                  <td className="px-3 py-2 text-sm text-stone-700">{z.zone}</td>
                  <Cell v={z.confirmed} tone="text-emerald-700" />
                  <Cell v={z.awaiting + z.pending} tone="text-amber-700" />
                  <Cell v={z.free} />
                  <td className={`${TD} font-semibold`}>{n(z.tables)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function SalesSummaryPage() {
  const [data, setData] = useState<SalesSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/admin/merch/summary")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch(() => setError("โหลดข้อมูลสรุปไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const t = data?.merchTotals;
  const tableBooked = data?.events.reduce((s, e) => s + sum3(e.tables), 0) ?? 0;
  const tableTotal = data?.events.reduce((s, e) => s + e.totalTables, 0) ?? 0;
  const shirtsQty = data?.merch.filter((r) => r.size).reduce((s, r) => s + r.total, 0) ?? 0;

  // จัดกลุ่มแถวตามชื่อสินค้าเพื่อแสดงยอดรวมย่อยของสินค้าที่มีหลายไซซ์
  const groups: { name: string; rows: SalesSummary["merch"] }[] = [];
  for (const r of data?.merch ?? []) {
    const g = groups[groups.length - 1];
    if (g && g.name === r.productName) g.rows.push(r);
    else groups.push({ name: r.productName, rows: [r] });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-display font-semibold text-stone-800">สรุปยอดสินค้าและโต๊ะ</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            คำนวณสดจากฐานข้อมูล · ไม่นับรายการที่ถูกปฏิเสธหรือหมดเวลา
            {data && ` · ข้อมูล ณ ${new Date(data.generatedAt).toLocaleString("th-TH")}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors disabled:opacity-50"
          >
            {loading ? "กำลังโหลด…" : "รีเฟรช"}
          </button>
          <a
            href="/api/admin/merch/summary/export"
            className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors"
          >
            Export Excel
          </a>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      {data && t && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <AdminStatCard icon="table" label="โต๊ะที่ถูกจอง" value={`${n(tableBooked)} / ${n(tableTotal)}`} tone="navy" />
            <AdminStatCard icon="bag" label="ของที่ระลึก (ชิ้น)" value={n(t.total)} sub={`ยืนยันแล้ว ${n(t.confirmed)}`} tone="violet" />
            <AdminStatCard icon="box" label="เสื้อทุกไซซ์ (ตัว)" value={n(shirtsQty)} tone="amber" />
            <AdminStatCard icon="coin" label="ยอดขายของที่ระลึกยืนยันแล้ว" value={`${n(t.revenueConfirmed)} บาท`} tone="emerald" />
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-stone-800">การจองโต๊ะ</h2>
            {data.events.length === 0 && <p className="text-sm text-stone-500">ยังไม่มีงานเลี้ยง</p>}
            {data.events.map((e) => (
              <EventBlock key={e.eventId} e={e} />
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-stone-800">ของที่ระลึก</h2>
            <div className="bg-white rounded-2xl border border-cream-200 shadow-sm overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-cream-200 bg-cream-50">
                  <tr>
                    <th className={`${TH} text-left`}>สินค้า</th>
                    <th className={`${TH} text-left`}>ไซซ์</th>
                    <th className={`${TH} text-right`}>ยืนยันแล้ว</th>
                    <th className={`${TH} text-right`}>รอตรวจสลิป</th>
                    <th className={`${TH} text-right`}>รอชำระ</th>
                    <th className={`${TH} text-right`}>รวม</th>
                    <th className={`${TH} text-right border-l border-cream-200`}>ออนไลน์</th>
                    <th className={`${TH} text-right`}>หน้างาน</th>
                    <th className={`${TH} text-right`}>แพ็กเกจโต๊ะ</th>
                    <th className={`${TH} text-right border-l border-cream-200`}>ยอดเงินยืนยัน</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.length === 0 && (
                    <tr><td colSpan={10} className="px-3 py-6 text-center text-sm text-stone-500">ยังไม่มีการสั่งซื้อ</td></tr>
                  )}
                  {groups.map((g) => {
                    const sub = g.rows.reduce(
                      (a, r) => ({ c: a.c + r.confirmed, w: a.w + r.awaiting, p: a.p + r.pending, t: a.t + r.total, o: a.o + r.online, s: a.s + r.pos, k: a.k + r.withTable, m: a.m + r.revenueConfirmed }),
                      { c: 0, w: 0, p: 0, t: 0, o: 0, s: 0, k: 0, m: 0 }
                    );
                    return [
                      ...g.rows.map((r, i) => (
                        <tr key={`${g.name}|${r.size}`} className="border-t border-cream-100">
                          <td className="px-3 py-2 text-sm text-stone-800">{i === 0 ? g.name : ""}</td>
                          <td className="px-3 py-2 text-sm text-stone-600">{r.size ?? "-"}</td>
                          <Cell v={r.confirmed} tone="text-emerald-700" />
                          <Cell v={r.awaiting} tone="text-amber-700" />
                          <Cell v={r.pending} />
                          <td className={`${TD} font-semibold text-stone-800`}>{n(r.total)}</td>
                          <td className={`${TD} border-l border-cream-100 ${r.online ? "text-stone-600" : "text-stone-300"}`}>{n(r.online)}</td>
                          <Cell v={r.pos} tone="text-stone-600" />
                          <Cell v={r.withTable} tone="text-stone-600" />
                          <td className={`${TD} border-l border-cream-100 ${r.revenueConfirmed ? "text-stone-700" : "text-stone-300"}`}>{n(r.revenueConfirmed)}</td>
                        </tr>
                      )),
                      g.rows.length > 1 && (
                        <tr key={`${g.name}|sub`} className="bg-cream-50/60">
                          <td className="px-3 py-1.5 text-xs text-stone-500" colSpan={2}>รวม {g.name}</td>
                          <td className={`${TD} text-xs font-semibold`}>{n(sub.c)}</td>
                          <td className={`${TD} text-xs font-semibold`}>{n(sub.w)}</td>
                          <td className={`${TD} text-xs font-semibold`}>{n(sub.p)}</td>
                          <td className={`${TD} text-xs font-semibold`}>{n(sub.t)}</td>
                          <td className={`${TD} text-xs border-l border-cream-100`}>{n(sub.o)}</td>
                          <td className={`${TD} text-xs`}>{n(sub.s)}</td>
                          <td className={`${TD} text-xs`}>{n(sub.k)}</td>
                          <td className={`${TD} text-xs border-l border-cream-100`}>{n(sub.m)}</td>
                        </tr>
                      ),
                    ];
                  })}
                </tbody>
                {groups.length > 0 && (
                  <tfoot className="border-t-2 border-cream-200 bg-cream-50">
                    <tr className="font-semibold">
                      <td className="px-3 py-2 text-sm" colSpan={2}>รวมทั้งหมด</td>
                      <td className={TD}>{n(t.confirmed)}</td>
                      <td className={TD}>{n(t.awaiting)}</td>
                      <td className={TD}>{n(t.pending)}</td>
                      <td className={TD}>{n(t.total)}</td>
                      <td className={`${TD} border-l border-cream-200`}>{n(t.online)}</td>
                      <td className={TD}>{n(t.pos)}</td>
                      <td className={TD}>{n(t.withTable)}</td>
                      <td className={`${TD} border-l border-cream-200`}>{n(t.revenueConfirmed)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <p className="text-xs text-stone-400">
              ขายหน้างาน (POS) นับเป็นยืนยันแล้วทั้งหมด · ของในแพ็กเกจจองโต๊ะไม่มีราคาแยก จึงไม่รวมในยอดเงิน
            </p>
          </section>
        </>
      )}
    </div>
  );
}
