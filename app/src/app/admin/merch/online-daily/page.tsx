"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { OnlineDailySummary } from "@/lib/onlineDailySummary";

const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const bkkToday = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const addDays = (s: string, n: number) => new Date(new Date(`${s}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
const thaiDate = (s: string) =>
  new Date(`${s}T00:00:00+07:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", weekday: "short", timeZone: "Asia/Bangkok" });

export default function OnlineDailySummaryPage() {
  const [from, setFrom] = useState(() => bkkToday());
  const [to, setTo] = useState(() => bkkToday());
  const [data, setData] = useState<OnlineDailySummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  // เจ้าหน้าที่การเงินเห็นเฉพาะหน้านี้ (ไม่มีสิทธิ์หน้าขาย/ประวัติการขาย) — ซ่อนลิงก์ที่จะเด้งกลับ
  useEffect(() => {
    fetch("/api/admin/me").then((r) => (r.ok ? r.json() : null)).then((d) => setRole(d?.role ?? null)).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch(`/api/admin/merch/online-daily-summary?from=${from}&to=${to}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error === "INVALID_RANGE" ? "วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด" : d.error === "RANGE_TOO_LONG" ? "เลือกช่วงได้ไม่เกิน 1 ปี" : d.error || "โหลดข้อมูลไม่สำเร็จ");
        setData(d.summary);
      })
      .catch((e) => setError(e.message || "เกิดข้อผิดพลาด"))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  function preset(kind: "today" | "yesterday" | "7" | "month") {
    const t = bkkToday();
    if (kind === "today") (setFrom(t), setTo(t));
    else if (kind === "yesterday") (setFrom(addDays(t, -1)), setTo(addDays(t, -1)));
    else if (kind === "7") (setFrom(addDays(t, -6)), setTo(t));
    else (setFrom(`${t.slice(0, 8)}01`), setTo(t));
  }

  const t = data?.totals;
  const card = "bg-white border border-cream-200 rounded-xl p-4";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-display font-semibold text-stone-800">สรุปยอดขายออนไลน์รายวัน</h1>
          <p className="text-sm text-stone-500 mt-0.5">นับเฉพาะคำสั่งซื้อที่ยืนยันสลิปแล้ว ตามวันที่ยืนยัน (ไม่รวมรอตรวจสลิป/ปฏิเสธ/หมดเวลา)</p>
        </div>
        {role !== "FINANCE_STAFF" && (
        <div className="flex gap-2">
          <Link href="/admin/merch/orders" className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50">
            คำสั่งซื้อทั้งหมด
          </Link>
        </div>
        )}
      </div>

      <div className={`${card} flex flex-wrap items-end gap-3`}>
        <label className="text-sm text-stone-600">
          ตั้งแต่
          <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="block mt-1 border border-stone-300 rounded-lg px-2 py-1.5" />
        </label>
        <label className="text-sm text-stone-600">
          ถึง
          <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className="block mt-1 border border-stone-300 rounded-lg px-2 py-1.5" />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {([["today", "วันนี้"], ["yesterday", "เมื่อวาน"], ["7", "7 วันล่าสุด"], ["month", "เดือนนี้"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => preset(k)} className="border border-stone-300 bg-white hover:bg-cream-50 rounded-lg px-3 py-1.5 text-sm text-stone-700">
              {label}
            </button>
          ))}
        </div>
        <a
          href={`/api/admin/merch/online-daily-summary?from=${from}&to=${to}&format=xlsx`}
          className="ml-auto bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg px-4 py-2 text-sm font-semibold"
        >
          Export Excel
        </a>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {loading && !data && <p className="text-sm text-stone-400">กำลังโหลด...</p>}

      {data && t && (
        <>
          {data.awaitingNow > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-sm px-4 py-2">
              ขณะนี้มี {data.awaitingNow} คำสั่งซื้อที่รอตรวจสลิป — ยังไม่นับในยอดด้านล่างจนกว่าจะยืนยัน
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className={card}>
              <div className="text-xs text-stone-500">ยอดรวม</div>
              <div className="text-2xl font-bold text-maroon-700">{baht(t.total)} <span className="text-sm font-normal">บาท</span></div>
            </div>
            <div className={card}>
              <div className="text-xs text-stone-500">ค่าสินค้า</div>
              <div className="text-xl font-bold text-stone-800">{baht(t.goods)}</div>
            </div>
            <div className={card}>
              <div className="text-xs text-stone-500">ค่าจัดส่ง</div>
              <div className="text-xl font-bold text-stone-800">{baht(t.shipping)}</div>
            </div>
            <div className={card}>
              <div className="text-xs text-stone-500">จำนวนออเดอร์ / ชิ้น</div>
              <div className="text-xl font-bold text-stone-800">{t.orders} / {t.items}</div>
            </div>
          </div>

          <div className={`${card} overflow-x-auto`}>
            <h2 className="font-display font-semibold text-stone-800 mb-2">สรุปรายวัน</h2>
            {data.days.length === 0 ? (
              <p className="text-sm text-stone-400">ไม่มียอดขายออนไลน์ในช่วงวันที่เลือก</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-stone-500 border-b border-cream-200">
                    <th className="py-2 pr-3">วันที่</th>
                    <th className="py-2 pr-3 text-right">ออเดอร์</th>
                    <th className="py-2 pr-3 text-right">ชิ้น</th>
                    <th className="py-2 pr-3 text-right">ค่าสินค้า</th>
                    <th className="py-2 pr-3 text-right">ค่าจัดส่ง</th>
                    <th className="py-2 text-right">รวม (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.days.map((d) => (
                    <tr key={d.date} className="border-b border-cream-100">
                      <td className="py-2 pr-3">{thaiDate(d.date)}</td>
                      <td className="py-2 pr-3 text-right">{d.orders}</td>
                      <td className="py-2 pr-3 text-right">{d.items}</td>
                      <td className="py-2 pr-3 text-right">{baht(d.goods)}</td>
                      <td className="py-2 pr-3 text-right">{baht(d.shipping)}</td>
                      <td className="py-2 text-right font-semibold">{baht(d.total)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="py-2 pr-3">รวม</td>
                    <td className="py-2 pr-3 text-right">{t.orders}</td>
                    <td className="py-2 pr-3 text-right">{t.items}</td>
                    <td className="py-2 pr-3 text-right">{baht(t.goods)}</td>
                    <td className="py-2 pr-3 text-right">{baht(t.shipping)}</td>
                    <td className="py-2 text-right text-maroon-700">{baht(t.total)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {data.products.length > 0 && (
            <div className={`${card} overflow-x-auto`}>
              <h2 className="font-display font-semibold text-stone-800 mb-2">ยอดขายตามสินค้า</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-stone-500 border-b border-cream-200">
                    <th className="py-2 pr-3">สินค้า</th>
                    <th className="py-2 pr-3">ไซซ์</th>
                    <th className="py-2 pr-3 text-right">จำนวน</th>
                    <th className="py-2 text-right">ยอดเงิน (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((p, i) => (
                    <tr key={i} className="border-b border-cream-100">
                      <td className="py-2 pr-3">{p.productName}</td>
                      <td className="py-2 pr-3">{p.size ?? "-"}</td>
                      <td className="py-2 pr-3 text-right">{p.qty}</td>
                      <td className="py-2 text-right">{baht(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
