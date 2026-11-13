"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QrCode from "@/app/components/qr-code";

type QItem = { productName: string; size: string | null; quantity: number };
type QOrder = {
  id: string;
  orderCode: string;
  bookerName: string;
  bookerPhone: string;
  shippingAddress: string;
  addrManual: boolean;
  labelPrintedAt: string | null;
  packedAt: string | null;
  trackingNumber: string | null;
  createdAt: string;
  items: QItem[];
};
type Sender = {
  name: string;
  phone: string;
  line: string;
  subdistrict: string;
  district: string;
  province: string;
  postcode: string;
};

type Filter = "todo" | "printed" | "packed" | "all";
type Mode = "labels" | "pick";

const pad2 = (n: number) => String(n).padStart(2, "0");
// วันที่ (เวลาท้องถิ่นของเบราว์เซอร์) รูปแบบ YYYY-MM-DD เทียบกับค่าจาก <input type="date">
function dayKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function dayAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayKey(d);
}
function inRange(o: QOrder, from: string, to: string) {
  if (!from && !to) return true;
  const k = dayKey(new Date(o.createdAt));
  if (from && k < from) return false;
  if (to && k > to) return false;
  return true;
}
function matchFilter(o: QOrder, f: Filter) {
  if (f === "todo") return !o.labelPrintedAt;
  if (f === "printed") return !!o.labelPrintedAt && !o.packedAt;
  if (f === "packed") return !!o.packedAt;
  return true;
}
function fmtOrderedAt(iso: string) {
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: "todo", label: "ยังไม่ปริ้นที่อยู่" },
  { key: "printed", label: "ปริ้นแล้ว ยังไม่แพ็ค" },
  { key: "packed", label: "แพ็คแล้ว" },
  { key: "all", label: "ทั้งหมดที่รอส่ง" },
];

function itemText(it: QItem) {
  return `${it.productName}${it.size ? ` (${it.size})` : ""} ×${it.quantity}`;
}

function senderAddressLine(s: Sender) {
  return [s.line, s.subdistrict, s.district, s.province, s.postcode].filter(Boolean).join(" ");
}

// ขนาดตัวอักษรของสติกเกอร์ตามจำนวนใบต่อหน้า (ยิ่งน้อยใบ ยิ่งใหญ่)
const LABEL_FONT: Record<number, { name: number; body: number; small: number; qr: number }> = {
  4: { name: 17, body: 14, small: 11, qr: 84 },
  6: { name: 15, body: 12.5, small: 10, qr: 72 },
  8: { name: 13.5, body: 11.5, small: 9, qr: 62 },
};
const LABEL_ROWS: Record<number, number> = { 4: 2, 6: 3, 8: 4 };

function Label({ o, sender, per }: { o: QOrder; sender: Sender; per: number }) {
  const f = LABEL_FONT[per];
  const from = [sender.name, sender.phone].filter(Boolean).join("  โทร ");
  const fromAddr = senderAddressLine(sender);
  return (
    <div className="label-cell" style={{ fontSize: f.body }}>
      <div style={{ fontSize: f.small, color: "#444", lineHeight: 1.3 }}>
        <b>จาก</b> {from}
        {fromAddr ? <div>{fromAddr}</div> : null}
      </div>
      <div style={{ borderTop: "1px solid #000", margin: "1.5mm 0" }} />
      <div style={{ fontSize: f.small, fontWeight: 700 }}>ถึง</div>
      <div style={{ fontSize: f.name, fontWeight: 700, lineHeight: 1.25 }}>{o.bookerName}</div>
      <div style={{ fontWeight: 600 }}>โทร {o.bookerPhone}</div>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.35, marginTop: "0.8mm" }}>{o.shippingAddress}</div>
      <div className="label-foot" style={{ fontSize: f.small }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>{o.orderCode}</div>
          <div style={{ color: "#444", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {o.items.map(itemText).join(", ")}
          </div>
        </div>
        <QrCode value={o.orderCode} size={f.qr} />
      </div>
    </div>
  );
}

export default function PrintMerchShippingPage() {
  const [orders, setOrders] = useState<QOrder[]>([]);
  const [sender, setSender] = useState<Sender>({
    name: "", phone: "", line: "", subdistrict: "", district: "", province: "", postcode: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("todo");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [mode, setMode] = useState<Mode>("labels");
  const [per, setPer] = useState<number>(8);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [askMark, setAskMark] = useState(false);
  const [msg, setMsg] = useState("");
  const [initialised, setInitialised] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/merch/orders/queue");
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "โหลดไม่สำเร็จ");
      setOrders(d.orders || []);
      if (d.sender) setSender(d.sender);
      setError("");
      return (d.orders || []) as QOrder[];
    } catch (e: any) {
      setError(e?.message || "โหลดไม่สำเร็จ");
      return [] as QOrder[];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().then((list) => {
      if (!initialised) {
        setSelected(new Set(list.filter((o) => !o.labelPrintedAt).map((o) => o.id)));
        setInitialised(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ออเดอร์ในช่วงวันที่สั่งซื้อที่เลือก (ไม่เลือก = ทั้งหมด)
  const dated = useMemo(() => orders.filter((o) => inRange(o, dateFrom, dateTo)), [orders, dateFrom, dateTo]);

  const visible = useMemo(() => dated.filter((o) => matchFilter(o, filter)), [dated, filter]);

  const counts = useMemo(
    () => ({
      todo: dated.filter((o) => matchFilter(o, "todo")).length,
      printed: dated.filter((o) => matchFilter(o, "printed")).length,
      packed: dated.filter((o) => matchFilter(o, "packed")).length,
      all: dated.length,
    }),
    [dated]
  );

  // พิมพ์/ทำเครื่องหมายเฉพาะที่อยู่ในช่วงวันที่ — ออเดอร์นอกช่วงที่เคยติ๊กไว้จะไม่ถูกพิมพ์
  const chosen = useMemo(() => dated.filter((o) => selected.has(o.id)), [dated, selected]);

  function applyDateRange(from: string, to: string) {
    setDateFrom(from);
    setDateTo(to);
    // เปลี่ยนช่วงวันที่ → เลือกอัตโนมัติทุกรายการในช่วงที่ตรงหมวดปัจจุบัน
    setSelected(new Set(orders.filter((o) => inRange(o, from, to) && matchFilter(o, filter)).map((o) => o.id)));
  }
  const hasDate = !!(dateFrom || dateTo);
  const allVisibleSelected = visible.length > 0 && visible.every((o) => selected.has(o.id));

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleAllVisible() {
    setSelected((s) => {
      const n = new Set(s);
      if (allVisibleSelected) visible.forEach((o) => n.delete(o.id));
      else visible.forEach((o) => n.add(o.id));
      return n;
    });
  }

  async function mark(action: "labelPrinted" | "labelClear" | "packed" | "packedClear") {
    if (chosen.length === 0) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/admin/merch/orders/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: chosen.map((o) => o.id), action }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "บันทึกไม่สำเร็จ");
      setMsg(`บันทึกแล้ว ${d.updated} รายการ`);
      setAskMark(false);
      await load();
    } catch (e: any) {
      setMsg(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  function doPrint() {
    if (chosen.length === 0) return;
    window.print();
    // เบราว์เซอร์คืนค่ากลับหลังปิดหน้าต่างพิมพ์ — ถามว่าจะทำเครื่องหมายปริ้นแล้วไหม (กันกดพิมพ์ซ้ำ/หลุดใบ)
    if (mode === "labels") setAskMark(true);
  }

  // รวมยอดสินค้าสำหรับใบหยิบ
  const pickTotals = useMemo(() => {
    const m = new Map<string, { productName: string; size: string | null; quantity: number }>();
    for (const o of chosen)
      for (const it of o.items) {
        const k = `${it.productName}|${it.size ?? ""}`;
        const cur = m.get(k);
        if (cur) cur.quantity += it.quantity;
        else m.set(k, { productName: it.productName, size: it.size, quantity: it.quantity });
      }
    return Array.from(m.values()).sort((a, b) =>
      a.productName === b.productName
        ? (a.size ?? "").localeCompare(b.size ?? "", "th", { numeric: true })
        : a.productName.localeCompare(b.productName, "th")
    );
  }, [chosen]);

  const pages = useMemo(() => {
    const out: QOrder[][] = [];
    for (let i = 0; i < chosen.length; i += per) out.push(chosen.slice(i, i + per));
    return out;
  }, [chosen, per]);

  return (
    <div className="space-y-4">
      <div className="space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-display font-semibold text-stone-800">ปริ้นที่อยู่จัดส่ง / แพ็คสินค้า</h1>
            <p className="text-sm text-stone-500 mt-0.5">
              เลือกคำสั่งซื้อที่ชำระแล้วและรอจัดส่ง → ปริ้นสติกเกอร์ที่อยู่ (A4) → แพ็คใส่ซอง → ส่งมอบขนส่งแล้วกรอกเลขพัสดุ
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/merch/orders/tracking"
              className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors"
            >
              กรอกเลขพัสดุเป็นชุด →
            </Link>
            <Link
              href="/admin/merch/orders"
              className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors"
            >
              กลับ
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                filter === f.key
                  ? "bg-primary-700 text-white border-primary-700"
                  : "bg-white text-stone-600 border-stone-300 hover:bg-cream-50"
              }`}
            >
              {f.label} ({counts[f.key]})
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-stone-500">วันที่สั่งซื้อ</span>
          <input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => applyDateRange(e.target.value, dateTo)}
            className="border border-stone-300 rounded-lg px-2 py-1.5 bg-white"
            aria-label="สั่งซื้อตั้งแต่วันที่"
          />
          <span className="text-stone-400">ถึง</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => applyDateRange(dateFrom, e.target.value)}
            className="border border-stone-300 rounded-lg px-2 py-1.5 bg-white"
            aria-label="สั่งซื้อถึงวันที่"
          />
          {[
            { label: "วันนี้", from: dayAgo(0), to: dayAgo(0) },
            { label: "เมื่อวาน", from: dayAgo(1), to: dayAgo(1) },
            { label: "7 วันล่าสุด", from: dayAgo(6), to: dayAgo(0) },
          ].map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyDateRange(p.from, p.to)}
              className={`px-2.5 py-1.5 rounded-lg border transition-colors ${
                dateFrom === p.from && dateTo === p.to
                  ? "bg-primary-700 text-white border-primary-700"
                  : "bg-white text-stone-600 border-stone-300 hover:bg-cream-50"
              }`}
            >
              {p.label}
            </button>
          ))}
          {hasDate && (
            <button
              type="button"
              onClick={() => applyDateRange("", "")}
              className="px-2.5 py-1.5 rounded-lg text-stone-500 hover:text-stone-800 underline"
            >
              ล้างวันที่
            </button>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {loading ? (
          <p className="text-sm text-stone-400">กำลังโหลด...</p>
        ) : visible.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-cream-200 p-8 text-center text-stone-400 text-sm">
            {hasDate ? "ไม่มีรายการในช่วงวันที่นี้" : "ไม่มีรายการในหมวดนี้"}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2 border-b border-cream-100 bg-cream-50/60 text-sm">
              <label className="flex items-center gap-2 text-stone-600">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
                เลือกทั้งหมดในหมวดนี้
              </label>
              <span className="text-stone-400">เลือกแล้ว {chosen.length} จาก {dated.length}</span>
            </div>
            <ul className="divide-y divide-cream-100 max-h-[360px] overflow-y-auto">
              {visible.map((o) => (
                <li key={o.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                  <input type="checkbox" className="mt-1" checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono font-semibold text-stone-800">{o.orderCode}</span>
                      <span className="text-stone-700">{o.bookerName}</span>
                      <span className="text-[11px] text-stone-400">สั่ง {fmtOrderedAt(o.createdAt)}</span>
                      {o.labelPrintedAt && (
                        <span className="text-[11px] px-2 py-0.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200">
                          ปริ้นแล้ว
                        </span>
                      )}
                      {o.packedAt && (
                        <span className="text-[11px] px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                          แพ็คแล้ว
                        </span>
                      )}
                      {o.addrManual && (
                        <span className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                          ⚠ ที่อยู่กรอกเอง ตรวจก่อนส่ง
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-stone-500 truncate">{o.items.map(itemText).join(", ")}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-cream-200 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-stone-500">แบบพิมพ์</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              className="border border-stone-300 rounded-lg px-2 py-1.5"
            >
              <option value="labels">สติกเกอร์ที่อยู่</option>
              <option value="pick">ใบหยิบสินค้า (รวมยอด)</option>
            </select>
          </div>
          {mode === "labels" && (
            <div className="flex items-center gap-2">
              <span className="text-stone-500">ใบต่อหน้า A4</span>
              <select
                value={per}
                onChange={(e) => setPer(Number(e.target.value))}
                className="border border-stone-300 rounded-lg px-2 py-1.5"
              >
                <option value={4}>4 (ใหญ่)</option>
                <option value={6}>6</option>
                <option value={8}>8 (เล็ก)</option>
              </select>
            </div>
          )}
          <button
            onClick={doPrint}
            disabled={chosen.length === 0}
            className="bg-primary-700 text-white rounded-lg px-4 py-2 font-medium hover:bg-primary-800 transition-colors disabled:opacity-50"
          >
            พิมพ์ ({chosen.length})
          </button>
          <span className="hidden sm:inline text-stone-300">|</span>
          <button
            onClick={() => mark("packed")}
            disabled={busy || chosen.length === 0}
            className="rounded-lg px-3 py-2 border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors disabled:opacity-50"
          >
            ทำเครื่องหมาย "แพ็คแล้ว"
          </button>
          <button
            onClick={() => mark("packedClear")}
            disabled={busy || chosen.length === 0}
            className="rounded-lg px-3 py-2 text-stone-500 hover:bg-stone-100 transition-colors disabled:opacity-50"
          >
            ยกเลิกแพ็ค
          </button>
          <button
            onClick={() => mark("labelClear")}
            disabled={busy || chosen.length === 0}
            className="rounded-lg px-3 py-2 text-stone-500 hover:bg-stone-100 transition-colors disabled:opacity-50"
          >
            ยกเลิกปริ้น
          </button>
          {msg && <span className="text-emerald-700">{msg}</span>}
        </div>

        {askMark && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <span>พิมพ์เสร็จเรียบร้อยแล้วใช่ไหม? ทำเครื่องหมาย "ปริ้นแล้ว" ให้ {chosen.length} รายการ</span>
            <button
              onClick={() => mark("labelPrinted")}
              disabled={busy}
              className="rounded-lg px-3 py-1.5 bg-sky-700 text-white hover:bg-sky-800 disabled:opacity-50"
            >
              ใช่ ทำเครื่องหมายปริ้นแล้ว
            </button>
            <button onClick={() => setAskMark(false)} className="rounded-lg px-3 py-1.5 text-sky-800 hover:bg-sky-100">
              ยังไม่ (พิมพ์ใหม่ได้)
            </button>
          </div>
        )}

        <p className="text-xs text-stone-400">
          ตัวอย่างด้านล่างคือสิ่งที่จะพิมพ์ — ตอนสั่งพิมพ์ให้ตั้งกระดาษ A4 สเกล 100% (Default) ไม่ใช้ "Fit to page"
        </p>
      </div>

      {/* ---------- พื้นที่พิมพ์ ---------- */}
      <div className="print-area">
        {chosen.length === 0 ? (
          <div className="text-center text-stone-400 text-sm py-10 print:hidden">ยังไม่ได้เลือกรายการ</div>
        ) : mode === "labels" ? (
          pages.map((pg, pi) => (
            <div key={pi} className="sheet-wrap">
              <div className="sheet" style={{ gridTemplateRows: `repeat(${LABEL_ROWS[per]}, 1fr)` }}>
                {pg.map((o) => (
                  <Label key={o.id} o={o} sender={sender} per={per} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="sheet-wrap">
            <div className="pick-sheet">
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>ใบหยิบสินค้า — {chosen.length} คำสั่งซื้อ</h2>
              <div style={{ fontSize: 11, color: "#555", marginBottom: "3mm" }}>
                พิมพ์เมื่อ {new Date().toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
              </div>
              <h3 style={{ fontWeight: 700, margin: "2mm 0" }}>ยอดรวมที่ต้องหยิบ</h3>
              <table className="pick-table">
                <thead>
                  <tr>
                    <th>สินค้า</th>
                    <th style={{ width: 70 }}>ไซซ์</th>
                    <th style={{ width: 70, textAlign: "right" }}>จำนวน</th>
                  </tr>
                </thead>
                <tbody>
                  {pickTotals.map((t) => (
                    <tr key={`${t.productName}|${t.size ?? ""}`}>
                      <td>{t.productName}</td>
                      <td>{t.size || "-"}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{t.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3 style={{ fontWeight: 700, margin: "5mm 0 2mm" }}>รายการตามคำสั่งซื้อ</h3>
              <table className="pick-table">
                <thead>
                  <tr>
                    <th style={{ width: 24 }}>✓</th>
                    <th style={{ width: 90 }}>รหัส</th>
                    <th style={{ width: 130 }}>ผู้รับ</th>
                    <th>สินค้า</th>
                  </tr>
                </thead>
                <tbody>
                  {chosen.map((o) => (
                    <tr key={o.id}>
                      <td>☐</td>
                      <td style={{ fontFamily: "monospace" }}>{o.orderCode}</td>
                      <td>{o.bookerName}</td>
                      <td>{o.items.map(itemText).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .sheet-wrap {
          zoom: 0.62;
          margin: 0 auto 16px;
          width: 194mm;
        }
        .sheet {
          width: 194mm;
          height: 280mm;
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: #fff;
          box-shadow: 0 1px 6px rgba(0, 0, 0, 0.25);
        }
        .label-cell {
          border: 1px dashed #888;
          padding: 4mm;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          color: #000;
          background: #fff;
        }
        .label-foot {
          margin-top: auto;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 3mm;
        }
        .pick-sheet {
          width: 194mm;
          min-height: 280mm;
          padding: 6mm;
          background: #fff;
          box-shadow: 0 1px 6px rgba(0, 0, 0, 0.25);
          color: #000;
          box-sizing: border-box;
        }
        .pick-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .pick-table th,
        .pick-table td {
          border: 1px solid #999;
          padding: 3px 6px;
          text-align: left;
          vertical-align: top;
        }
        .pick-table th {
          background: #eee;
        }
        .pick-table tr {
          break-inside: avoid;
        }
        @media print {
          @page {
            size: A4;
            margin: 8mm;
          }
          html,
          body {
            background: #fff !important;
          }
          nav,
          header,
          aside {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
          }
          .sheet-wrap {
            zoom: 1;
            margin: 0;
          }
          .sheet,
          .pick-sheet {
            box-shadow: none;
          }
          .print-area > .sheet-wrap {
            page-break-after: always;
            break-after: page;
          }
          .print-area > .sheet-wrap:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .pick-sheet {
            min-height: 0;
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
}
