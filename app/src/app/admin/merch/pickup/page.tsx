"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PItem = { productName: string; size: string | null; quantity: number };
type POrder = {
  id: string;
  orderCode: string;
  bookerName: string;
  bookerPhone: string;
  totalAmount: number;
  createdAt: string;
  pickedUpAt: string | null;
  pickedUpBy: string | null;
  items: PItem[];
};
type Tab = "waiting" | "done" | "all";

const fmt = (iso: string) => new Date(iso).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
const itemText = (it: PItem) => `${it.productName}${it.size ? ` (${it.size})` : ""} ×${it.quantity}`;

export default function MerchPickupPage() {
  const [tab, setTab] = useState<Tab>("waiting");
  const [q, setQ] = useState("");
  const [orders, setOrders] = useState<POrder[]>([]);
  const [counts, setCounts] = useState({ waiting: 0, done: 0, unpaid: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null); // กดครั้งแรก = รอยืนยันซ้ำ กันกดพลาด
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/merch/orders/pickup?status=${tab}&q=${encodeURIComponent(q.trim())}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "โหลดไม่สำเร็จ");
      setOrders(d.orders || []);
      setCounts(d.counts || { waiting: 0, done: 0, unpaid: 0 });
      setError("");
    } catch (e: any) {
      setError(e?.message || "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [tab, q]);

  // ค้นหาแบบหน่วงเวลาเล็กน้อยตอนพิมพ์
  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  function arm(id: string) {
    setArmedId(id);
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setArmedId(null), 5000);
  }

  async function mark(id: string, done: boolean) {
    setBusyId(id);
    setError("");
    try {
      const r = await fetch("/api/admin/merch/orders/pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, done }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "บันทึกไม่สำเร็จ");
      setArmedId(null);
      await load();
    } catch (e: any) {
      setError(e?.message || "บันทึกไม่สำเร็จ");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const tabs: { key: Tab; label: string; n?: number }[] = [
    { key: "waiting", label: "รอรับสินค้า", n: counts.waiting },
    { key: "done", label: "รับแล้ว", n: counts.done },
    { key: "all", label: "ทั้งหมด", n: counts.waiting + counts.done },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-display font-semibold text-stone-800">รับสินค้าที่วิทยาลัย</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          ออเดอร์ที่ลูกค้าเลือกมารับเอง และยืนยันการชำระเงินแล้ว — ตรวจสินค้ากับลูกค้า แล้วกดยืนยันเมื่อส่งมอบ
        </p>
      </div>

      {counts.unpaid > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          มีออเดอร์รับที่วิทยาลัยอีก {counts.unpaid} รายการที่ยังไม่ผ่านการยืนยันสลิป (ยังไม่แสดงในรายการนี้) — ตรวจสอบที่เมนู "คำสั่งซื้อของที่ระลึก"
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" className="flex gap-1 rounded-xl bg-stone-100 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all ${
                tab === t.key ? "bg-white text-maroon-700 shadow-sm ring-1 ring-maroon-700/20" : "text-stone-500 hover:text-stone-800"
              }`}
            >
              {t.label} <span className="tabular-nums opacity-70">{t.n ?? 0}</span>
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหา รหัสออเดอร์ / ชื่อ / เบอร์โทร"
          className="min-w-[240px] flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
          autoFocus
        />
        <button onClick={load} disabled={loading} className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 disabled:opacity-50">
          {loading ? "กำลังโหลด…" : "รีเฟรช"}
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}

      {!loading && orders.length === 0 && (
        <div className="rounded-xl border border-cream-200 bg-white px-4 py-10 text-center text-sm text-stone-500">
          {q ? "ไม่พบออเดอร์ที่ตรงกับคำค้นหา" : tab === "done" ? "ยังไม่มีออเดอร์ที่รับสินค้าแล้ว" : "ไม่มีออเดอร์ที่รอรับสินค้า"}
        </div>
      )}

      <ul className="space-y-3">
        {orders.map((o) => {
          const done = !!o.pickedUpAt;
          const armed = armedId === o.id;
          return (
            <li key={o.id} className={`rounded-xl border bg-white p-4 ${done ? "border-emerald-200" : "border-cream-200"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-base font-bold tracking-wide text-stone-800">{o.orderCode}</span>
                    {done ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">รับแล้ว</span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">รอรับสินค้า</span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-stone-700">
                    {o.bookerName} · <a href={`tel:${o.bookerPhone}`} className="underline decoration-dotted">{o.bookerPhone}</a>
                  </div>
                  <div className="text-xs text-stone-400">สั่งเมื่อ {fmt(o.createdAt)} · ยอด {o.totalAmount.toLocaleString("th-TH")} บาท</div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {done ? (
                    <>
                      <div className="text-right text-xs text-emerald-700">
                        รับเมื่อ {fmt(o.pickedUpAt!)}
                        {o.pickedUpBy ? <> · โดย {o.pickedUpBy}</> : null}
                      </div>
                      <button
                        onClick={() => (armed ? mark(o.id, false) : arm(o.id))}
                        disabled={busyId === o.id}
                        className={`rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${
                          armed ? "border-red-300 bg-red-50 text-red-700" : "border-stone-300 bg-white text-stone-600 hover:bg-cream-50"
                        }`}
                      >
                        {armed ? "กดอีกครั้งเพื่อยกเลิกการรับ" : "ยกเลิกการรับ"}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => (armed ? mark(o.id, true) : arm(o.id))}
                      disabled={busyId === o.id}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 ${
                        armed ? "bg-emerald-600 hover:bg-emerald-700" : "bg-maroon-700 hover:bg-maroon-800"
                      }`}
                    >
                      {busyId === o.id ? "กำลังบันทึก…" : armed ? "กดอีกครั้งเพื่อยืนยันว่ารับสินค้าแล้ว" : "ลูกค้ารับสินค้าแล้ว"}
                    </button>
                  )}
                </div>
              </div>

              <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-dashed border-stone-200 pt-3">
                {o.items.map((it, i) => (
                  <li key={i} className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-xs text-stone-700">{itemText(it)}</li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
