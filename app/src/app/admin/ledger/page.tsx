"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminStatCard } from "@/app/components/admin-stat-card";
import type { LedgerDay, LedgerRange, StreamTotals } from "@/lib/ledger";

type DayResp = LedgerDay & { categories: { income: string[]; expense: string[] } };

// ซ่อน "รายการที่กรอกเอง" และ "ปิดยอดประจำวัน" (ปิดที่ API ด้วย — ดู LEDGER_MANUAL_AND_CLOSING_ENABLED ใน lib/ledger.ts) เปลี่ยนเป็น true คู่กันเพื่อเปิดกลับ
const SHOW_MANUAL_AND_CLOSING = false;

const baht = (v: number) => v.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thDate = (s: string) => new Date(`${s}T00:00:00+07:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
const bkkToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const shift = (s: string, n: number) => new Date(Date.parse(`${s}T00:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);

const SOURCE_LABEL: Record<string, string> = {
  reservation: "จองโต๊ะ",
  merch: "ของที่ระลึก (ออนไลน์) — ค่าสินค้า",
  merch_ship: "ของที่ระลึก (ออนไลน์) — ค่าจัดส่ง",
  pos: "ขายหน้างาน (POS)",
  support: "ศิษย์เก่าดีเด่น/ผู้สนับสนุน",
};
const STREAM_LABEL: Record<string, string> = {
  event: "งานเลี้ยง (จองโต๊ะ)",
  merch: "ของที่ระลึก",
  shipping: "ค่าจัดส่ง",
  support: "เงินสนับสนุน",
  general: "ทั่วไป",
};
const STREAM_ORDER = ["event", "merch", "shipping", "support", "general"];

function StreamTable({ title, hint, data }: { title: string; hint?: string; data: StreamTotals }) {
  const rows = STREAM_ORDER.map((k) => ({ k, ...data[k as keyof StreamTotals] }));
  const tot = rows.reduce((a, r) => ({ income: a.income + r.income, expense: a.expense + r.expense, net: a.net + r.net }), { income: 0, expense: 0, net: 0 });
  return (
    <section className="bg-white rounded-2xl border border-cream-200 shadow-sm p-5 space-y-2">
      <h2 className="font-semibold text-stone-800">{title}</h2>
      {hint && <p className="text-xs text-stone-500">{hint}</p>}
      <table className="w-full text-sm">
        <thead><tr className="text-xs text-stone-500 text-left"><th className="py-1">หมวดงาน</th><th className="text-right">รายรับ</th><th className="text-right">รายจ่าย</th><th className="text-right">คงเหลือ</th></tr></thead>
        <tbody>
          {rows.filter((r) => r.income || r.expense || r.k !== "general").map((r) => (
            <tr key={r.k} className="border-t border-stone-100">
              <td className="py-2">{STREAM_LABEL[r.k]}</td>
              <td className="text-right tabular-nums">{baht(r.income)}</td>
              <td className="text-right tabular-nums">{baht(r.expense)}</td>
              <td className={`text-right tabular-nums font-medium ${r.net < 0 ? "text-red-600" : ""}`}>{baht(r.net)}</td>
            </tr>
          ))}
          <tr className="border-t border-stone-300 font-semibold">
            <td className="py-2">รวม</td>
            <td className="text-right tabular-nums">{baht(tot.income)}</td>
            <td className="text-right tabular-nums">{baht(tot.expense)}</td>
            <td className="text-right tabular-nums">{baht(tot.net)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
const INPUT = "w-full border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white";
const BTN = "bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors disabled:opacity-50";
const BTN_PRIMARY = "bg-maroon-700 text-white rounded-lg px-4 py-2 text-sm hover:bg-maroon-800 transition-colors disabled:opacity-50";

async function call(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `เกิดข้อผิดพลาด (${r.status})`);
  return j;
}

export default function LedgerPage() {
  const [tab, setTab] = useState<"day" | "range">("day");
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/admin/me").then((r) => (r.ok ? r.json() : null)).then((d) => setRole(d?.role ?? null)).catch(() => {});
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">สมุดบัญชีรายวัน</h1>
          <p className="text-sm text-stone-500 mt-1">รายรับดึงจากรายการที่ยืนยันแล้วโดยอัตโนมัติ</p>
        </div>
        <div className="inline-flex rounded-lg border border-stone-300 overflow-hidden text-sm bg-white">
          {(["day", "range"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 ${tab === t ? "bg-maroon-700 text-white" : "text-stone-600 hover:bg-cream-50"}`}>
              {t === "day" ? "รายวัน" : "สรุปช่วงวัน"}
            </button>
          ))}
        </div>
      </div>
      {tab === "day" ? <DayView isSuper={role === "SUPER_ADMIN"} /> : <RangeView />}
    </div>
  );
}

function DayView({ isSuper }: { isSuper: boolean }) {
  const [date, setDate] = useState(bkkToday());
  const [data, setData] = useState<DayResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showItems, setShowItems] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await call(`/api/admin/ledger?date=${date}`));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [date]);
  useEffect(() => { load(); }, [load]);

  const closed = !!data?.closing;

  async function voidEntry(id: string) {
    const reason = window.prompt("เหตุผลที่ยกเลิกรายการนี้");
    if (!reason?.trim()) return;
    try {
      await call(`/api/admin/ledger/entries/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
      load();
    } catch (e: any) { setError(e.message); }
  }
  async function reopen() {
    if (!window.confirm(`เปิดยอดวันที่ ${thDate(date)} ใหม่? ตัวเลขที่ปิดไว้จะถูกลบ (บันทึกลงบันทึกการใช้งาน)`)) return;
    try {
      await call(`/api/admin/ledger/close?date=${date}`, { method: "DELETE" });
      load();
    } catch (e: any) { setError(e.message); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button className={BTN} onClick={() => setDate(shift(date, -1))}>‹ วันก่อน</button>
        <input type="date" value={date} max={bkkToday()} onChange={(e) => e.target.value && setDate(e.target.value)} className="border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white" />
        <button className={BTN} onClick={() => setDate(shift(date, 1))} disabled={date >= bkkToday()}>วันถัดไป ›</button>
        <button className={BTN} onClick={() => setDate(bkkToday())}>วันนี้</button>
        <button className={BTN} onClick={load} disabled={loading}>{loading ? "กำลังโหลด…" : "รีเฟรช"}</button>
        <a className={BTN} href={`/api/admin/ledger/export?from=${date}&to=${date}`}>Export Excel</a>
        {SHOW_MANUAL_AND_CLOSING && <span className={`ml-auto text-xs px-3 py-1 rounded-full border ${closed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
          {closed ? "ปิดยอดแล้ว" : "ยังไม่ปิดยอด"}
        </span>}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      {data && (
        <>
          {SHOW_MANUAL_AND_CLOSING && data.drift != null && data.drift !== 0 && (
            <div className="bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-4 py-3 text-sm">
              ยอดรายรับจากระบบตอนนี้ต่างจากตอนปิดยอด <b>{data.drift > 0 ? "+" : ""}{baht(data.drift)} บาท</b> (เช่น มีสลิปที่อนุมัติหลังปิดยอด) ตัวเลขที่ปิดไว้ไม่ถูกแก้ — ให้ผู้ดูแลสูงสุดเปิดยอดแล้วปิดใหม่หากต้องการปรับ
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <AdminStatCard icon="coin" label="รายรับจากระบบ" value={baht(data.auto.total)} sub={`${data.auto.count} รายการ`} tone="emerald" />
            <AdminStatCard icon="coin" label="รายรับกรอกเอง" value={baht(data.manual.income)} tone="sky" />
            <AdminStatCard icon="coin" label="รายจ่าย" value={baht(data.manual.expense)} tone="rose" />
            <AdminStatCard icon="coin" label="คงเหลือสุทธิ" value={baht(data.net)} tone="navy" />
          </div>

          <section className="bg-white rounded-2xl border border-cream-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-stone-800">รายรับอัตโนมัติ (ยืนยันแล้วเท่านั้น)</h2>
              <button className="text-sm text-maroon-700 hover:underline" onClick={() => setShowItems((v) => !v)}>{showItems ? "ซ่อนรายการ" : `ดูรายการ (${data.items.length})`}</button>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(data.auto.bySource).map(([k, v]) => (
                  <tr key={k} className="border-t border-stone-100">
                    <td className="py-2 text-stone-700">{SOURCE_LABEL[k] ?? k}</td>
                    <td className="py-2 text-right text-stone-400">{v.count} รายการ</td>
                    <td className="py-2 text-right tabular-nums w-40">{baht(v.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t border-stone-300 font-semibold">
                  <td className="py-2">รวม (เงินสด {baht(data.auto.cash)} · โอน {baht(data.auto.transfer)})</td>
                  <td />
                  <td className="py-2 text-right tabular-nums">{baht(data.auto.total)}</td>
                </tr>
              </tbody>
            </table>
            {showItems && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs mt-2">
                  <thead><tr className="text-stone-500 text-left"><th className="py-1">แหล่งที่มา</th><th>รหัส</th><th>ชื่อ</th><th>ช่องทาง</th><th className="text-right">จำนวนเงิน</th></tr></thead>
                  <tbody>
                    {data.items.map((i) => (
                      <tr key={`${i.source}-${i.ref}`} className="border-t border-stone-100">
                        <td className="py-1">{SOURCE_LABEL[i.source]}</td><td>{i.ref}</td><td>{i.name ?? "-"}</td><td>{i.method === "cash" ? "เงินสด" : "โอน"}</td>
                        <td className="text-right tabular-nums">{baht(i.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <StreamTable title="แยกตามหมวดงาน" hint="การจองแพ็กเกจ (โต๊ะ + ของที่ระลึก) นับเป็นงานเลี้ยงทั้งก้อน" data={data.byStream} />

          {SHOW_MANUAL_AND_CLOSING && <section className="bg-white rounded-2xl border border-cream-200 shadow-sm p-5 space-y-3">
            <h2 className="font-semibold text-stone-800">รายการที่กรอกเอง</h2>
            {data.entries.length === 0 ? (
              <p className="text-sm text-stone-400">ยังไม่มีรายการ</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-stone-500 text-left"><th className="py-1">ประเภท</th><th>หมวด</th><th>หมวดงาน</th><th>รายละเอียด</th><th>ช่องทาง</th><th>ผู้บันทึก</th><th className="text-right">จำนวนเงิน</th><th /></tr></thead>
                  <tbody>
                    {data.entries.map((e) => (
                      <tr key={e.id} className={`border-t border-stone-100 ${e.voided ? "text-stone-300 line-through" : ""}`}>
                        <td className="py-2">{e.type === "income" ? "รายรับ" : "รายจ่าย"}</td>
                        <td>{e.category}</td>
                        <td>{STREAM_LABEL[e.stream] ?? "-"}</td>
                        <td>{e.description ?? ""}{e.receiptNo ? ` (ใบเสร็จ ${e.receiptNo})` : ""}{e.voided ? ` — ยกเลิก: ${e.voidReason}` : ""}</td>
                        <td>{e.method === "cash" ? "เงินสด" : "โอน"}</td>
                        <td>{e.createdByName ?? "-"}</td>
                        <td className="text-right tabular-nums">{baht(e.amount)}</td>
                        <td className="text-right">{!e.voided && !closed && <button className="text-xs text-red-600 hover:underline" onClick={() => voidEntry(e.id)}>ยกเลิก</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!closed && <EntryForm date={date} categories={data.categories} onSaved={load} onError={setError} />}
          </section>}

          {SHOW_MANUAL_AND_CLOSING && <section className="bg-white rounded-2xl border border-cream-200 shadow-sm p-5 space-y-3">
            <h2 className="font-semibold text-stone-800">ปิดยอดประจำวัน</h2>
            {closed ? (
              <div className="text-sm text-stone-700 space-y-1">
                <p>ปิดยอดโดย <b>{data.closing!.closedByName ?? "-"}</b> เมื่อ {new Date(data.closing!.closedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
                <p>สุทธิ ณ ตอนปิด <b>{baht(data.closing!.net)}</b> · เงินสดที่ควรมี {baht(data.closing!.expectedCash)}
                  {data.closing!.countedCash != null && <> · นับได้ {baht(data.closing!.countedCash)} · <span className={data.closing!.cashVariance ? "text-red-600 font-semibold" : "text-emerald-700"}>ผลต่าง {baht(data.closing!.cashVariance ?? 0)}</span></>}
                </p>
                {data.closing!.note && <p className="text-stone-500">หมายเหตุ: {data.closing!.note}</p>}
                {isSuper && <button className={`${BTN} mt-2`} onClick={reopen}>เปิดยอดใหม่ (ผู้ดูแลสูงสุด)</button>}
              </div>
            ) : (
              <CloseForm date={date} expectedCash={data.expectedCash} onClosed={load} onError={setError} />
            )}
          </section>}
        </>
      )}
    </div>
  );
}

function EntryForm({ date, categories, onSaved, onError }: { date: string; categories: { income: string[]; expense: string[] }; onSaved: () => void; onError: (m: string) => void }) {
  const [type, setType] = useState<"expense" | "income">("expense");
  const [method, setMethod] = useState<"cash" | "transfer">("cash");
  const [category, setCategory] = useState("");
  const [stream, setStream] = useState(""); // ว่าง = ให้ระบบเลือกตามหมวด
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [receiptNo, setReceiptNo] = useState("");
  const [saving, setSaving] = useState(false);
  const cats = categories[type];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    onError("");
    try {
      await call("/api/admin/ledger/entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, type, method, category: category || cats[0], stream, amount, description, receiptNo }) });
      setAmount(""); setDescription(""); setReceiptNo("");
      onSaved();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-3 border-t border-stone-200">
      <select className={INPUT} value={type} onChange={(e) => { setType(e.target.value as any); setCategory(""); }}>
        <option value="expense">รายจ่าย</option>
        <option value="income">รายรับ (กรอกเอง)</option>
      </select>
      <select className={INPUT} value={category || cats[0]} onChange={(e) => setCategory(e.target.value)}>
        {cats.map((c) => <option key={c}>{c}</option>)}
      </select>
      <select className={INPUT} value={method} onChange={(e) => setMethod(e.target.value as any)}>
        <option value="cash">เงินสด</option>
        <option value="transfer">โอน</option>
      </select>
      <select className={INPUT} value={stream} onChange={(e) => setStream(e.target.value)} title="หมวดงาน">
        <option value="">หมวดงาน: ตามหมวดรายการ</option>
        {STREAM_ORDER.map((k) => <option key={k} value={k}>{STREAM_LABEL[k]}</option>)}
      </select>
      <input className={INPUT} type="number" min="0.01" step="0.01" placeholder="จำนวนเงิน" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      <input className={`${INPUT} col-span-2`} placeholder="รายละเอียด (ไม่บังคับ)" value={description} onChange={(e) => setDescription(e.target.value)} />
      <input className={`${INPUT} col-span-2 md:col-span-3`} placeholder="เลขที่ใบเสร็จ (ไม่บังคับ)" value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} />
      <button className={`${BTN_PRIMARY} col-span-2 md:col-span-3`} disabled={saving}>{saving ? "กำลังบันทึก…" : "เพิ่มรายการ"}</button>
    </form>
  );
}

function CloseForm({ date, expectedCash, onClosed, onError }: { date: string; expectedCash: number; onClosed: () => void; onError: (m: string) => void }) {
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  async function close() {
    if (!window.confirm(`ปิดยอดวันที่ ${thDate(date)}? หลังปิดจะเพิ่ม/ยกเลิกรายการของวันนี้ไม่ได้จนกว่าผู้ดูแลสูงสุดจะเปิดยอด`)) return;
    setSaving(true);
    onError("");
    try {
      await call("/api/admin/ledger/close", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, countedCash: counted, note }) });
      onClosed();
    } catch (e: any) { onError(e.message); } finally { setSaving(false); }
  }
  return (
    <div className="space-y-3 text-sm">
      <p className="text-stone-600">เงินสดที่ควรมีในลิ้นชัก (POS เงินสด + เงินสดรับอื่นๆ − รายจ่ายเงินสด): <b>{baht(expectedCash)}</b> บาท</p>
      <div className="grid md:grid-cols-3 gap-2">
        <input className={INPUT} type="number" min="0" step="0.01" placeholder="เงินสดที่นับได้จริง (ไม่บังคับ)" value={counted} onChange={(e) => setCounted(e.target.value)} />
        <input className={`${INPUT} md:col-span-2`} placeholder="หมายเหตุ (ไม่บังคับ)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button className={BTN_PRIMARY} onClick={close} disabled={saving}>{saving ? "กำลังปิดยอด…" : "ปิดยอดประจำวัน"}</button>
    </div>
  );
}

function RangeView() {
  const [to, setTo] = useState(bkkToday());
  const [from, setFrom] = useState(shift(bkkToday(), -29));
  const [data, setData] = useState<LedgerRange | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await call(`/api/admin/ledger/summary?from=${from}&to=${to}`)); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white" />
        <span className="text-stone-400">ถึง</span>
        <input type="date" value={to} min={from} max={bkkToday()} onChange={(e) => e.target.value && setTo(e.target.value)} className="border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white" />
        <button className={BTN} onClick={load} disabled={loading}>{loading ? "กำลังโหลด…" : "รีเฟรช"}</button>
        <a className={BTN} href={`/api/admin/ledger/export?from=${from}&to=${to}`}>Export Excel</a>
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <AdminStatCard icon="coin" label="รายรับจากระบบ" value={baht(data.totals.auto)} tone="emerald" />
            <AdminStatCard icon="coin" label="รายรับกรอกเอง" value={baht(data.totals.manualIncome)} tone="sky" />
            <AdminStatCard icon="coin" label="รายจ่าย" value={baht(data.totals.expense)} tone="rose" />
            <AdminStatCard icon="coin" label="คงเหลือสุทธิ" value={baht(data.totals.net)} sub={SHOW_MANUAL_AND_CLOSING ? `ปิดแล้ว ${data.totals.closedDays} วัน · ยังไม่ปิด ${data.totals.openDays} วัน` : undefined} tone="navy" />
          </div>
          <div className="bg-white rounded-2xl border border-cream-200 shadow-sm p-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-stone-500 text-left"><th className="py-1">วันที่</th><th className="text-right">รายรับจากระบบ</th><th className="text-right">รายรับกรอกเอง</th><th className="text-right">รายจ่าย</th><th className="text-right">สุทธิ</th>{SHOW_MANUAL_AND_CLOSING && <th className="text-center">สถานะ</th>}</tr></thead>
              <tbody>
                {data.rows.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-stone-400">ไม่มีความเคลื่อนไหวในช่วงนี้</td></tr>}
                {data.rows.map((r) => (
                  <tr key={r.date} className="border-t border-stone-100">
                    <td className="py-2">{thDate(r.date)}</td>
                    <td className="text-right tabular-nums">{baht(r.auto)}</td>
                    <td className="text-right tabular-nums">{baht(r.manualIncome)}</td>
                    <td className="text-right tabular-nums">{baht(r.expense)}</td>
                    <td className="text-right tabular-nums font-medium">{baht(r.net)}</td>
                    {SHOW_MANUAL_AND_CLOSING && <td className="text-center text-xs">{r.closed ? (r.drift ? <span className="text-amber-700">ปิดแล้ว (ยอดต่าง {baht(r.drift)})</span> : <span className="text-emerald-700">ปิดแล้ว</span>) : <span className="text-stone-400">ยังไม่ปิด</span>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <StreamTable title="แยกตามหมวดงาน" hint="รายรับ = จากระบบ + กรอกเอง · แพ็กเกจ (โต๊ะ + ของที่ระลึก) นับเป็นงานเลี้ยงทั้งก้อน" data={data.byStream} />
          {data.expenseByCategory.length > 0 && (
            <div className="bg-white rounded-2xl border border-cream-200 shadow-sm p-5">
              <h2 className="font-semibold text-stone-800 mb-2">รายจ่ายแยกหมวด</h2>
              <table className="w-full text-sm"><tbody>
                {data.expenseByCategory.map((c) => <tr key={c.category} className="border-t border-stone-100"><td className="py-2">{c.category}</td><td className="text-right tabular-nums">{baht(c.amount)}</td></tr>)}
              </tbody></table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
