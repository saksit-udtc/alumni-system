"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Stock = { id: string; size: string | null; quantity: number };
type Product = { id: string; name: string; price: string | number; stocks: Stock[] };
type WItem = { id: string; productName: string; size: string | null; quantity: number; unitPrice: string | number };
type Withdrawal = {
  id: string;
  code: string;
  requesterName: string;
  requesterPosition: string | null;
  purpose: string;
  approverName: string;
  note: string | null;
  status: "active" | "cancelled";
  createdAt: string;
  cancelReason: string | null;
  items: WItem[];
  createdBy: { username: string };
};
type Line = { key: number; productId: string; stockId: string; quantity: number };

const fmt = (iso: string) => new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
const itemText = (it: WItem) => `${it.productName}${it.size ? ` (${it.size})` : ""} ×${it.quantity}`;
const INPUT = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300";

export default function MerchWithdrawalsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [list, setList] = useState<Withdrawal[]>([]);
  const [canCancel, setCanCancel] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ key: 1, productId: "", stockId: "", quantity: 1 }]);
  const [requesterName, setRequesterName] = useState("");
  const [requesterPosition, setRequesterPosition] = useState("");
  const [purpose, setPurpose] = useState("");
  const [approverName, setApproverName] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const [p, w] = await Promise.all([fetch("/api/admin/pos/products"), fetch("/api/admin/merch/withdrawals")]);
      const pd = await p.json();
      const wd = await w.json();
      if (!p.ok) throw new Error(pd?.error || "โหลดสินค้าไม่สำเร็จ");
      if (!w.ok) throw new Error(wd?.error || "โหลดใบเบิกไม่สำเร็จ");
      setProducts(pd.products || []);
      setList(wd.withdrawals || []);
      setCanCancel(!!wd.canCancel);
      setError("");
    } catch (e: any) {
      setError(e?.message || "โหลดไม่สำเร็จ");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  function setLine(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function pickProduct(key: number, productId: string) {
    const p = productById.get(productId);
    // สินค้าที่ไม่มีไซซ์มีสต๊อกแถวเดียว เลือกให้อัตโนมัติ
    const only = p && p.stocks.length === 1 ? p.stocks[0].id : "";
    setLine(key, { productId, stockId: only });
  }

  async function submit() {
    setMsg("");
    setError("");
    const items = lines.filter((l) => l.stockId).map((l) => ({ stockId: l.stockId, quantity: l.quantity }));
    if (items.length === 0) return setError("กรุณาเลือกสินค้า (และไซซ์) อย่างน้อย 1 รายการ");
    if (!requesterName.trim() || !purpose.trim() || !approverName.trim()) return setError("กรุณากรอกผู้เบิก วัตถุประสงค์ และผู้อนุมัติ ให้ครบ");
    setBusy(true);
    try {
      const r = await fetch("/api/admin/merch/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterName, requesterPosition, purpose, approverName, note, items }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "บันทึกไม่สำเร็จ");
      setMsg(`บันทึกใบเบิก ${d.withdrawal.code} แล้ว และตัดสต๊อกเรียบร้อย`);
      setLines([{ key: Date.now(), productId: "", stockId: "", quantity: 1 }]);
      setRequesterName("");
      setRequesterPosition("");
      setPurpose("");
      setApproverName("");
      setNote("");
      await load();
      window.open(`/admin/merch/withdrawals/${d.withdrawal.id}/print`, "_blank");
    } catch (e: any) {
      setError(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(w: Withdrawal) {
    const reason = window.prompt(`ยกเลิกใบเบิก ${w.code} และคืนสต๊อก\nกรุณาระบุเหตุผล:`);
    if (reason === null) return;
    if (!reason.trim()) return setError("กรุณาระบุเหตุผลการยกเลิก");
    const r = await fetch(`/api/admin/merch/withdrawals/${w.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setError(d?.error || "ยกเลิกไม่สำเร็จ");
    setMsg(`ยกเลิกใบเบิก ${w.code} และคืนสต๊อกแล้ว`);
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-stone-800">เบิกของที่ระลึก (ไม่คิดเงิน)</h1>
        <p className="text-sm text-stone-500">ใช้เมื่อผู้บริหารเบิกของไปใช้งาน เช่น สัมมนาผู้มีอุปการคุณ — ตัดสต๊อกทันที ไม่นับเป็นรายรับ และพิมพ์ใบเบิกให้ลงนามได้</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
      {msg && <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">{msg}</div>}

      <section className="bg-white rounded-2xl border border-cream-200 shadow-sm p-4 space-y-4">
        <h2 className="font-semibold text-stone-800">สร้างใบเบิกใหม่</h2>
        <div className="space-y-2">
          {lines.map((l) => {
            const p = productById.get(l.productId);
            const st = p?.stocks.find((s) => s.id === l.stockId);
            return (
              <div key={l.key} className="grid grid-cols-12 gap-2 items-center">
                <select className={`${INPUT} col-span-12 sm:col-span-5`} value={l.productId} onChange={(e) => pickProduct(l.key, e.target.value)}>
                  <option value="">— เลือกสินค้า —</option>
                  {products.map((pr) => (
                    <option key={pr.id} value={pr.id}>{pr.name}</option>
                  ))}
                </select>
                <select className={`${INPUT} col-span-6 sm:col-span-3`} value={l.stockId} onChange={(e) => setLine(l.key, { stockId: e.target.value })} disabled={!p}>
                  <option value="">{p ? "— ไซซ์ —" : "—"}</option>
                  {p?.stocks.map((s) => (
                    <option key={s.id} value={s.id}>{s.size ?? "ไม่มีไซซ์"} (เหลือ {s.quantity})</option>
                  ))}
                </select>
                <input type="number" min={1} max={st?.quantity ?? undefined} className={`${INPUT} col-span-4 sm:col-span-2`} value={l.quantity} onChange={(e) => setLine(l.key, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
                <button type="button" className="col-span-2 text-sm text-red-600 hover:underline" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))}>ลบ</button>
              </div>
            );
          })}
          <button type="button" className="text-sm text-violet-700 hover:underline" onClick={() => setLines((ls) => [...ls, { key: Date.now(), productId: "", stockId: "", quantity: 1 }])}>+ เพิ่มรายการ</button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm text-stone-700">ผู้เบิก (ชื่อ-สกุล) *<input className={INPUT} value={requesterName} onChange={(e) => setRequesterName(e.target.value)} /></label>
          <label className="text-sm text-stone-700">ตำแหน่ง / หน่วยงาน<input className={INPUT} value={requesterPosition} onChange={(e) => setRequesterPosition(e.target.value)} /></label>
          <label className="text-sm text-stone-700 sm:col-span-2">วัตถุประสงค์การเบิก *<input className={INPUT} placeholder="เช่น สัมมนาผู้มีอุปการคุณ" value={purpose} onChange={(e) => setPurpose(e.target.value)} /></label>
          <label className="text-sm text-stone-700">ผู้อนุมัติ (ชื่อ-สกุล) *<input className={INPUT} value={approverName} onChange={(e) => setApproverName(e.target.value)} /></label>
          <label className="text-sm text-stone-700">หมายเหตุ<input className={INPUT} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        </div>

        <button type="button" disabled={busy} onClick={submit} className="rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50">
          {busy ? "กำลังบันทึก..." : "บันทึกใบเบิก + ตัดสต๊อก + พิมพ์"}
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-stone-800">ประวัติใบเบิก</h2>
        {list.length === 0 && <p className="text-sm text-stone-500">ยังไม่มีใบเบิก</p>}
        {list.map((w) => (
          <div key={w.id} className={`bg-white rounded-xl border p-3 text-sm ${w.status === "cancelled" ? "border-stone-200 opacity-60" : "border-cream-200"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold text-stone-800">
                {w.code} <span className="font-normal text-stone-500">· {fmt(w.createdAt)}</span>
                {w.status === "cancelled" && <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs">ยกเลิกแล้ว</span>}
              </div>
              <div className="flex gap-3">
                <Link href={`/admin/merch/withdrawals/${w.id}/print`} target="_blank" className="text-violet-700 hover:underline">พิมพ์ใบเบิก</Link>
                {canCancel && w.status === "active" && <button className="text-red-600 hover:underline" onClick={() => cancel(w)}>ยกเลิก/คืนสต๊อก</button>}
              </div>
            </div>
            <div className="text-stone-700 mt-1">{w.items.map(itemText).join(", ")}</div>
            <div className="text-stone-500">ผู้เบิก {w.requesterName}{w.requesterPosition ? ` (${w.requesterPosition})` : ""} · {w.purpose} · อนุมัติโดย {w.approverName} · บันทึกโดย {w.createdBy.username}</div>
            {w.status === "cancelled" && w.cancelReason && <div className="text-stone-500">เหตุผลยกเลิก: {w.cancelReason}</div>}
          </div>
        ))}
      </section>
    </div>
  );
}
