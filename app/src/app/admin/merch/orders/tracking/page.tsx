"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CARRIER_LABEL,
  normalizeTrackingNumber,
  extractTrackingNumber,
  validateTrackingNumber,
  type Carrier,
} from "@/lib/shipping";

type QItem = { productName: string; size: string | null; quantity: number };
type QOrder = {
  id: string;
  orderCode: string;
  bookerName: string;
  bookerPhone: string;
  shippingAddress: string;
  packedAt: string | null;
  labelPrintedAt: string | null;
  items: QItem[];
};
type RowResult = { ok: boolean; error?: string; emailSent?: boolean };

const CHUNK = 10;

function itemText(it: QItem) {
  return `${it.productName}${it.size ? ` (${it.size})` : ""} ×${it.quantity}`;
}

export default function BulkTrackingPage() {
  const [orders, setOrders] = useState<QOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [carrier, setCarrier] = useState<Carrier>("FLASH");
  const [drafts, setDrafts] = useState<Record<string, string>>({}); // keyed by order id
  const [results, setResults] = useState<Record<string, RowResult>>({});
  const [onlyPacked, setOnlyPacked] = useState(false);
  const [scan, setScan] = useState("");
  const [paste, setPaste] = useState("");
  const [pasteMsg, setPasteMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/merch/orders/queue");
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "โหลดไม่สำเร็จ");
      setOrders(d.orders || []);
      setError("");
    } catch (e: any) {
      setError(e?.message || "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(
    () => orders.filter((o) => (onlyPacked ? !!o.packedAt : true) || results[o.id]?.ok),
    [orders, onlyPacked, results]
  );
  const byCode = useMemo(() => {
    const m = new Map<string, QOrder>();
    orders.forEach((o) => m.set(o.orderCode.toUpperCase(), o));
    return m;
  }, [orders]);

  function focusRow(id: string) {
    const el = inputs.current[id];
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.focus();
      el.select();
    }
  }

  function onScan(e: React.FormEvent) {
    e.preventDefault();
    const code = scan.trim().toUpperCase();
    if (!code) return;
    const o = byCode.get(code);
    if (!o) {
      setPasteMsg(`ไม่พบคำสั่งซื้อ ${code} ในรายการรอส่ง`);
    } else {
      setPasteMsg("");
      focusRow(o.id);
    }
    setScan("");
  }

  function onEnterRow(e: React.KeyboardEvent, idx: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const next = rows.slice(idx + 1).find((o) => !results[o.id]?.ok);
    if (next) focusRow(next.id);
  }

  function applyPaste() {
    // แยกข้อความเป็น "ชุดข้อมูล" ต่อเลขพัสดุ 1 เลข: บรรทัดที่มีเลขพัสดุเริ่มชุดใหม่
    // บรรทัดถัดไปที่ไม่มีเลข (ชื่อ/เบอร์/จังหวัด จากแอป Flash) ต่อท้ายชุดเดิม
    const recs: { tracking: string; text: string }[] = [];
    for (const line of paste.split(/\r?\n/)) {
      const t = extractTrackingNumber(line, carrier);
      if (t) recs.push({ tracking: t, text: line.toUpperCase().replace(t, " ") });
      else if (recs.length) recs[recs.length - 1].text += " " + line.toUpperCase();
    }
    const digitsOf = (s: string) => s.replace(/\D/g, "");
    const next = { ...drafts };
    const taken = new Set<string>(); // ออเดอร์ที่ถูกจับคู่ไปแล้วในการวางครั้งนี้
    const ambiguous: string[] = [];
    const notFound: string[] = [];
    let filled = 0;
    for (const r of recs) {
      let candidates: QOrder[] = [];
      const tokens = r.text.split(/[^A-Z0-9]+/).filter(Boolean);
      const byTokenCode = tokens.map((tk) => byCode.get(tk)).find(Boolean);
      if (byTokenCode) candidates = [byTokenCode];
      else {
        const flat = digitsOf(r.text);
        candidates = orders.filter((o) => {
          const p = digitsOf(o.bookerPhone);
          return p.length >= 9 && flat.includes(p) && !taken.has(o.id);
        });
      }
      if (candidates.length === 1) {
        next[candidates[0].id] = r.tracking;
        taken.add(candidates[0].id);
        filled++;
      } else if (candidates.length > 1) ambiguous.push(`${r.tracking} (ตรง ${candidates.length} ออเดอร์: ${candidates.map((c) => c.orderCode).join(", ")})`);
      else notFound.push(r.tracking);
    }
    setDrafts(next);
    const parts = [`ใส่เลขให้ ${filled} จาก ${recs.length} รายการ`];
    if (ambiguous.length) parts.push(`กำกวม ไม่ได้ใส่ (ใช้รหัสคำสั่งซื้อแทน): ${ambiguous.join(" ; ")}`);
    if (notFound.length) parts.push(`ไม่พบออเดอร์ที่รอส่งตรงกัน: ${notFound.join(", ")}`);
    if (recs.length === 0) parts[0] = "ไม่พบเลขพัสดุในข้อความที่วาง (ตรวจว่าเลือกขนส่งถูกต้อง)";
    setPasteMsg(parts.join(" · "));
    if (recs.length > 0 && ambiguous.length === 0 && notFound.length === 0) setPaste("");
  }

  // ตรวจรูปแบบ/ซ้ำในหน้าก่อนส่ง
  const rowIssues = useMemo(() => {
    const issues: Record<string, string> = {};
    const seen = new Map<string, string>();
    for (const o of orders) {
      const n = normalizeTrackingNumber(drafts[o.id] || "");
      if (!n) continue;
      const fmt = validateTrackingNumber(carrier, n);
      if (fmt) issues[o.id] = fmt;
      else if (seen.has(n)) {
        issues[o.id] = "เลขซ้ำกับอีกรายการในหน้านี้";
        issues[seen.get(n)!] = "เลขซ้ำกับอีกรายการในหน้านี้";
      } else seen.set(n, o.id);
    }
    return issues;
  }, [orders, drafts, carrier]);

  const pending = useMemo(
    () => orders.filter((o) => (drafts[o.id] || "").trim() && !results[o.id]?.ok),
    [orders, drafts, results]
  );
  const blocked = pending.some((o) => rowIssues[o.id]);

  async function saveAll() {
    if (pending.length === 0 || blocked) return;
    setSaving(true);
    setPasteMsg("");
    const next = { ...results };
    try {
      for (let i = 0; i < pending.length; i += CHUNK) {
        const chunk = pending.slice(i, i + CHUNK);
        setProgress(`กำลังบันทึก ${Math.min(i + CHUNK, pending.length)}/${pending.length} ...`);
        const r = await fetch("/api/admin/merch/orders/bulk-tracking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            carrier,
            entries: chunk.map((o) => ({ orderCode: o.orderCode, trackingNumber: drafts[o.id] })),
          }),
        });
        const d = await r.json().catch(() => null);
        if (!r.ok || !d?.results) {
          chunk.forEach((o) => (next[o.id] = { ok: false, error: d?.error || "บันทึกไม่สำเร็จ" }));
        } else {
          d.results.forEach((res: any, idx: number) => {
            next[chunk[idx].id] = { ok: !!res.ok, error: res.error, emailSent: res.emailSent };
          });
        }
        setResults({ ...next });
      }
    } finally {
      setSaving(false);
      setProgress("");
    }
  }

  const okCount = Object.values(results).filter((r) => r.ok).length;
  const mailFail = Object.values(results).filter((r) => r.ok && !r.emailSent).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-display font-semibold text-stone-800">กรอกเลขพัสดุเป็นชุด</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            ใช้ตอนส่งมอบพัสดุให้พนักงานขนส่งแล้วได้เลขมา — บันทึกแล้วระบบส่งอีเมลแจ้งลูกค้าทุกรายการ
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/merch/orders/print"
            className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors"
          >
            ← ปริ้นที่อยู่/แพ็ค
          </Link>
          <Link
            href="/admin/merch/orders"
            className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors"
          >
            คำสั่งซื้อ
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-cream-200 p-4 space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="text-stone-500">ขนส่ง</span>
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value as Carrier)}
              className="border border-stone-300 rounded-lg px-2 py-1.5"
            >
              {(Object.keys(CARRIER_LABEL) as Carrier[]).map((c) => (
                <option key={c} value={c}>
                  {CARRIER_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-stone-600">
            <input type="checkbox" checked={onlyPacked} onChange={(e) => setOnlyPacked(e.target.checked)} />
            แสดงเฉพาะที่แพ็คแล้ว
          </label>
          <form onSubmit={onScan} className="flex items-center gap-2">
            <input
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              placeholder="สแกน/พิมพ์รหัสคำสั่งซื้อ แล้ว Enter"
              className="border border-stone-300 rounded-lg px-3 py-1.5 w-64 font-mono"
            />
          </form>
        </div>
        <details>
          <summary className="cursor-pointer text-stone-600">วางหลายรายการ (คัดลอกรายการจากแอป Flash มาวางได้ ระบบจับคู่ด้วยรหัสคำสั่งซื้อหรือเบอร์โทรผู้รับ)</summary>
          <div className="mt-2 space-y-2">
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={6}
              placeholder={"6VQQV7JU TH12345C6ABC7D\n0812345678 TH12345C6ABC7E\n\nหรือวางทั้งบล็อกจากแอป Flash:\nNo.: TH12345C6ABC7F  Picked up\nชื่อผู้รับ\n0891234567\nอุดรธานี"}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 font-mono text-xs"
            />
            <button
              onClick={applyPaste}
              disabled={!paste.trim()}
              className="px-3 py-1.5 rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200 disabled:opacity-50"
            >
              ใส่ลงในตาราง
            </button>
          </div>
        </details>
        {pasteMsg && <p className="text-xs text-amber-700">{pasteMsg}</p>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-stone-400">กำลังโหลด...</p>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-cream-200 p-10 text-center text-stone-400 text-sm">
          ไม่มีคำสั่งซื้อที่รอส่ง
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
          <ul className="divide-y divide-cream-100">
            {rows.map((o, idx) => {
              const res = results[o.id];
              const issue = rowIssues[o.id];
              return (
                <li key={o.id} className={`px-4 py-3 text-sm ${res?.ok ? "bg-emerald-50/50" : ""}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono font-semibold text-stone-800">{o.orderCode}</span>
                    <span className="text-stone-700">{o.bookerName}</span>
                    {o.packedAt ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                        แพ็คแล้ว
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-stone-500 truncate">{o.items.map(itemText).join(", ")}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {res?.ok ? (
                      <>
                        <span className="font-mono text-emerald-700">{normalizeTrackingNumber(drafts[o.id] || "")}</span>
                        <span className="text-xs text-emerald-700">✓ บันทึกแล้ว</span>
                        {res.emailSent ? (
                          <span className="text-xs text-emerald-700">· ส่งอีเมลแล้ว</span>
                        ) : (
                          <span className="text-xs text-amber-700">· ⚠ ส่งอีเมลไม่สำเร็จ (กด "ส่งอีเมลอีกครั้ง" ในหน้าคำสั่งซื้อ)</span>
                        )}
                      </>
                    ) : (
                      <input
                        ref={(el) => {
                          inputs.current[o.id] = el;
                        }}
                        value={drafts[o.id] ?? ""}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [o.id]: extractTrackingNumber(e.target.value, carrier) ?? e.target.value.toUpperCase(),
                          }))
                        }
                        onKeyDown={(e) => onEnterRow(e, idx)}
                        placeholder={carrier === "FLASH" ? "TH12345C6ABC7D" : "EE123456789TH"}
                        maxLength={24}
                        className={`font-mono text-sm border rounded-md px-2 py-1.5 w-64 focus:outline-none focus:ring-1 ${
                          issue ? "border-red-400 focus:ring-red-400" : "border-stone-300 focus:ring-primary-500"
                        }`}
                      />
                    )}
                    {!res?.ok && issue && <span className="text-xs text-red-600">{issue}</span>}
                    {!res?.ok && res?.error && <span className="text-xs text-red-600">{res.error}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="sticky bottom-0 bg-white/95 backdrop-blur border border-cream-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
        <button
          onClick={saveAll}
          disabled={saving || pending.length === 0 || blocked}
          className="bg-primary-700 text-white rounded-lg px-4 py-2 font-medium hover:bg-primary-800 transition-colors disabled:opacity-50"
        >
          บันทึกและส่งอีเมล ({pending.length})
        </button>
        {blocked && <span className="text-red-600">แก้รายการที่มีเลขผิดรูปแบบ/ซ้ำก่อน</span>}
        {progress && <span className="text-stone-500">{progress}</span>}
        {okCount > 0 && !saving && (
          <span className="text-emerald-700">
            บันทึกสำเร็จ {okCount} รายการ{mailFail > 0 ? ` · อีเมลไม่สำเร็จ ${mailFail}` : ""}
          </span>
        )}
        {okCount > 0 && !saving && (
          <button
            onClick={() => {
              setResults({});
              setDrafts({});
              load();
            }}
            className="px-3 py-2 rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200"
          >
            รีเฟรชรายการ
          </button>
        )}
      </div>
    </div>
  );
}
