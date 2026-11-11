"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import JsBarcode from "jsbarcode";
import QrCode from "@/app/components/qr-code";
import { generatePromptPayPayload } from "@/lib/promptpay";
import { publishDisplay, readDisplay } from "@/lib/posDisplay";

interface SaleItem {
  id: string;
  productName: string;
  size: string | null;
  quantity: number;
  unitPrice: string;
}
interface Sale {
  id: string;
  saleCode: string;
  paymentMethod: "cash" | "transfer";
  totalAmount: string;
  buyerName: string | null;
  buyerPhone: string | null;
  createdAt: string;
  // pending = โอนเงินรอผู้ขายยืนยันรับเงิน (ยังไม่ใช่ใบเสร็จ), paid = ชำระแล้ว, cancelled = ยกเลิก/หมดเวลา
  status: "pending" | "paid" | "cancelled";
  paidAt: string | null;
  holdUntil: string | null;
  cancelReason: string | null;
  items: SaleItem[];
  cashier: { username: string };
  // Legacy/unused going forward: an earlier iteration sold merch-only
  // Package bundles at the POS counter and tagged the PosSale with
  // packageId — that path was changed to online-only (see
  // lib/createMerchPackageOrder.ts), so this is always null for any new
  // sale. Left in place only in case old test data still has it set;
  // still renders correctly (bundled price line) if it ever is.
  package: { name: string } | null;
}

const PAYMENT_LABEL: Record<string, string> = { cash: "เงินสด", transfer: "โอนเงิน" };

// Narrow 80mm-thermal-receipt-width layout, printed via the browser's own
// print dialog — no separate PDF step, matches how order slips/QR tickets
// are handled elsewhere in this app.
export default function PosReceiptPage({ params }: { params: { id: string } }) {
  const [sale, setSale] = useState<Sale | null>(null);
  const [error, setError] = useState("");
  const [promptPayId, setPromptPayId] = useState("");
  const [busy, setBusy] = useState(false);
  // ต้องติ๊กยืนยันว่าตรวจเงินเข้าบัญชีแล้วก่อน จึงกดยืนยันรับเงิน/ออกใบเสร็จได้
  const [paidChecked, setPaidChecked] = useState(false);
  const [actionError, setActionError] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const barcodeRef = useRef<SVGSVGElement>(null);

  function loadSale() {
    return fetch(`/api/admin/pos/sales/${params.id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "ไม่พบข้อมูลการขาย");
        setSale(data.sale);
      })
      .catch((e) => setError(e.message || "เกิดข้อผิดพลาด"));
  }

  useEffect(() => {
    loadSale();
    fetch("/api/admin/pos/settings")
      .then((r) => r.json())
      .then((d) => setPromptPayId(d.promptPayId || ""))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  // ใบรอชำระ: นับถอยหลังเวลากันสต๊อก — หมดเวลาแล้วโหลดใหม่ (เซิร์ฟเวอร์จะยกเลิกและคืนสต๊อกให้)
  useEffect(() => {
    if (sale?.status !== "pending") return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sale?.status]);
  useEffect(() => {
    if (sale?.status === "pending" && sale.holdUntil && nowMs >= new Date(sale.holdUntil).getTime()) {
      loadSale();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMs]);

  // ส่งสถานะไปจอลูกค้า (/pos-display): รอชำระ → แสดงรายการ+QR/ยอดเงินสด, ยกเลิก → กลับหน้าว่าง
  useEffect(() => {
    if (!sale) return;
    if (sale.status === "pending") {
      const total = Number(sale.totalAmount);
      let qrPayload: string | null = null;
      if (sale.paymentMethod === "transfer" && promptPayId && total > 0) {
        try {
          qrPayload = generatePromptPayPayload(promptPayId, total);
        } catch {
          qrPayload = null;
        }
      }
      publishDisplay({
        kind: "pay",
        saleId: sale.id,
        saleCode: sale.saleCode,
        method: sale.paymentMethod,
        total,
        holdUntil: sale.holdUntil,
        lines: sale.items.map((it) => ({ name: it.productName, size: it.size, qty: it.quantity, unitPrice: Number(it.unitPrice) })),
        qrPayload,
      });
    } else if (sale.status === "cancelled") {
      publishDisplay({ kind: "idle" });
    }
  }, [sale, promptPayId]);
  // ออกจากหน้ารอชำระโดยไม่ได้ยืนยัน → ล้างจอลูกค้า (ถ้ายังแสดงใบนี้อยู่)
  useEffect(() => {
    return () => {
      const cur = readDisplay();
      if (cur.kind === "pay" && cur.saleId === params.id) publishDisplay({ kind: "idle" });
    };
  }, [params.id]);

  async function runAction(kind: "confirm" | "cancel") {
    if (!sale) return;
    if (kind === "cancel" && !window.confirm("ยกเลิกรายการนี้และคืนสินค้าเข้าสต๊อก ใช่หรือไม่?")) return;
    setBusy(true);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/pos/sales/${sale.id}/${kind}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "ดำเนินการไม่สำเร็จ");
        await loadSale();
        return;
      }
      setSale(data.sale);
      if (kind === "confirm") publishDisplay({ kind: "paid", total: Number(data.sale.totalAmount), at: Date.now() });
    } catch {
      setActionError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!sale || sale.status !== "paid" || !barcodeRef.current) return;
    try {
      JsBarcode(barcodeRef.current, sale.saleCode, {
        format: "CODE128",
        displayValue: true,
        height: 40,
        width: 1.6,
        fontSize: 12,
        margin: 4,
      });
    } catch {
      // Non-fatal — the receipt is still fully usable without the barcode.
    }
  }, [sale]);

  if (error) return <div className="text-red-600 text-sm p-4">{error}</div>;
  if (!sale) return <div className="text-sm text-stone-400 p-4">กำลังโหลด...</div>;

  const createdAt = new Date(sale.createdAt);

  // ยังไม่ชำระ/ยกเลิก: ไม่แสดงใบเสร็จและไม่มีปุ่มพิมพ์ (ไม่มี .pos-receipt-print → สั่งพิมพ์แล้วได้หน้าว่าง)
  if (sale.status !== "paid") {
    const total = Number(sale.totalAmount);
    const remainMs = sale.holdUntil ? new Date(sale.holdUntil).getTime() - nowMs : 0;
    const mm = String(Math.max(0, Math.floor(remainMs / 60000))).padStart(2, "0");
    const ss = String(Math.max(0, Math.floor((remainMs % 60000) / 1000))).padStart(2, "0");
    let payload: string | null = null;
    const isCash = sale.paymentMethod === "cash";
    if (sale.status === "pending" && !isCash && promptPayId && total > 0) {
      try {
        payload = generatePromptPayPayload(promptPayId, total);
      } catch {
        payload = null;
      }
    }
    const expired = sale.status === "cancelled" && sale.cancelReason === "expired";
    return (
      <div className="max-w-sm mx-auto space-y-3 print:hidden">
        <div
          className={`rounded-xl border p-4 ${
            sale.status === "pending" ? "bg-amber-50 border-amber-300" : "bg-stone-100 border-stone-300"
          }`}
        >
          <div className="font-display font-bold text-lg text-stone-800">
            {sale.status === "pending" ? "รอชำระเงิน — ยังไม่ใช่ใบเสร็จ" : expired ? "รายการหมดเวลา (ยกเลิกแล้ว)" : "รายการถูกยกเลิก"}
          </div>
          <div className="text-sm text-stone-600 mt-1">
            เลขที่ {sale.saleCode} · {sale.items.reduce((a, it) => a + it.quantity, 0)} ชิ้น · รวม{" "}
            <b className="text-maroon-700">{total.toLocaleString()} บาท</b>
          </div>
          {sale.status === "pending" && (
            <div className="text-sm text-amber-800 mt-1">
              กันสินค้าไว้อีก <b className="font-mono">{mm}:{ss}</b> นาที — หลังจากนั้นระบบจะคืนสต๊อกอัตโนมัติ
            </div>
          )}
        </div>

        <div className="bg-white border border-cream-200 rounded-xl p-3 text-sm space-y-0.5">
          {sale.items.map((it) => (
            <div key={it.id} className="flex justify-between gap-2">
              <span className="truncate">
                {it.productName}
                {it.size ? ` (${it.size})` : ""} × {it.quantity}
              </span>
              <span className="shrink-0">{(it.quantity * Number(it.unitPrice)).toLocaleString()}</span>
            </div>
          ))}
        </div>

        {sale.status === "pending" && (
          <>
            {isCash && (
              <div className="bg-white border border-cream-200 rounded-xl p-3 text-center">
                <div className="text-xs text-stone-500">ชำระด้วยเงินสด — รับเงินจากลูกค้า</div>
                <div className="text-2xl font-bold text-maroon-700 mt-1">{total.toLocaleString()} บาท</div>
              </div>
            )}
            {payload && (
              <div className="bg-white border border-cream-200 rounded-xl p-3 flex flex-col items-center text-center">
                <QrCode value={payload} size={200} />
                <div className="text-xs text-stone-500 mt-2">ให้ลูกค้าสแกนจ่าย {total.toLocaleString()} บาท</div>
              </div>
            )}
            <div className="text-xs text-stone-600">
              {isCash ? "รับเงินสด" : "ตรวจในแอปธนาคารว่าเงิน"} <b>{total.toLocaleString()} บาท</b> {isCash ? "ครบแล้ว" : "เข้าแล้วจริง"} จึงกดยืนยัน — ใบเสร็จจะพิมพ์ได้หลังจากนี้เท่านั้น
            </div>
          </>
        )}

        {expired && (
          <div className="text-xs text-stone-600">
            ถ้าลูกค้าเพิ่งโอนมาแล้วจริง กด "ลูกค้าจ่ายแล้ว" เพื่อกันสินค้ากลับและออกใบเสร็จ (ถ้าสินค้าไม่พอ ระบบจะแจ้ง)
          </div>
        )}

        {(sale.status === "pending" || expired) && (
          <label className="flex items-start gap-2 rounded-xl border border-cream-200 bg-white p-3 text-sm text-stone-800 cursor-pointer">
            <input
              type="checkbox"
              checked={paidChecked}
              onChange={(e) => setPaidChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span>
              {sale.paymentMethod === "cash" ? "ยืนยันว่าได้รับเงินสดครบ" : "ยืนยันว่าตรวจสอบแล้ว เงินเข้าบัญชีครบ"} <b>{total.toLocaleString()} บาท</b> เรียบร้อย
            </span>
          </label>
        )}

        {actionError && <p className="text-red-600 text-sm">{actionError}</p>}

        <div className="flex flex-col gap-2">
          {(sale.status === "pending" || expired) && (
            <button
              onClick={() => runAction("confirm")}
              disabled={busy || !paidChecked}
              className="w-full bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg py-3 font-semibold disabled:opacity-50"
            >
              {busy ? "กำลังดำเนินการ..." : sale.status === "pending" ? "ยืนยันรับเงินแล้ว (ออกใบเสร็จ)" : "ลูกค้าจ่ายแล้ว — กันสินค้าและออกใบเสร็จ"}
            </button>
          )}
          {sale.status === "pending" && (
            <button
              onClick={() => runAction("cancel")}
              disabled={busy}
              className="w-full bg-white border border-stone-300 rounded-lg py-2 text-sm text-stone-700 hover:bg-cream-50 disabled:opacity-50"
            >
              ยกเลิกรายการ (คืนสต๊อก)
            </button>
          )}
          <Link href="/admin/pos" className="w-full text-center bg-white border border-stone-300 rounded-lg py-2 text-sm text-stone-700 hover:bg-cream-50">
            กลับไปหน้าขาย
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-xs mx-auto flex gap-2 mb-4 print:hidden">
        <button onClick={() => window.print()} className="flex-1 bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg py-2 font-semibold text-sm">
          พิมพ์ใบเสร็จ
        </button>
        <Link href="/admin/pos" className="flex-1 text-center bg-white border border-stone-300 rounded-lg py-2 text-sm text-stone-700 hover:bg-cream-50">
          ขายรายการถัดไป
        </Link>
      </div>

      <div className="pos-receipt-print max-w-xs mx-auto bg-white border border-cream-200 shadow-md print:shadow-none print:border-0 rounded-lg p-4 font-mono text-sm text-stone-800">
        <div className="text-center mb-2">
          <div className="font-display font-bold text-base">ใบเสร็จรับเงิน</div>
          <div className="text-xs text-stone-500">ขายหน้างาน (POS) — งานคืนสู่เหย้า</div>
        </div>
        <div className="border-t border-dashed border-stone-300 my-2" />
        <div className="text-xs space-y-0.5">
          <div>เลขที่: {sale.saleCode}</div>
          <div>วันที่: {createdAt.toLocaleString("th-TH")}</div>
          <div>ผู้ขาย: {sale.cashier.username}</div>
          {sale.buyerName && <div>ผู้ซื้อ: {sale.buyerName}</div>}
          {sale.buyerPhone && <div>เบอร์โทร: {sale.buyerPhone}</div>}
        </div>
        <div className="border-t border-dashed border-stone-300 my-2" />
        {sale.package && (
          <div className="text-xs text-maroon-700 font-medium mb-1">แพ็กเกจ: {sale.package.name}</div>
        )}
        <div className="space-y-1">
          {sale.items.map((it) => (
            <div key={it.id} className="flex justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate">
                  {it.productName}
                  {it.size ? ` (${it.size})` : ""}
                </div>
                <div className="text-xs text-stone-500">
                  {it.quantity} {sale.package ? "ชิ้น (รวมในแพ็กเกจ)" : `x ${Number(it.unitPrice).toLocaleString()}`}
                </div>
              </div>
              {!sale.package && (
                <div className="shrink-0 font-medium">{(it.quantity * Number(it.unitPrice)).toLocaleString()}</div>
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-dashed border-stone-300 my-2" />
        <div className="flex justify-between font-bold text-base">
          <span>รวมทั้งสิ้น</span>
          <span>{Number(sale.totalAmount).toLocaleString()} บาท</span>
        </div>
        <div className="text-xs mt-1">ชำระโดย: {PAYMENT_LABEL[sale.paymentMethod] || sale.paymentMethod}</div>
        <div className="border-t border-dashed border-stone-300 my-2" />
        <div className="flex flex-col items-center py-1">
          <svg ref={barcodeRef} />
        </div>
        <div className="text-center text-xs text-stone-400 mt-1">ขอบคุณที่อุดหนุนของที่ระลึกงานคืนสู่เหย้า</div>
      </div>

      <style jsx global>{`
        @page {
          size: 80mm auto;
          margin: 0;
        }
        @media print {
          html,
          body {
            margin: 0;
            padding: 0;
            background: #fff;
          }
          body * {
            visibility: hidden;
          }
          .pos-receipt-print,
          .pos-receipt-print * {
            visibility: visible;
          }
          .pos-receipt-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 72mm; /* TSC TDM-30: พื้นที่พิมพ์จริง 72mm บนกระดาษ 80mm */
            max-width: 72mm;
            margin: 0;
            padding: 2mm;
            box-sizing: border-box;
          }
        }
      `}</style>
    </div>
  );
}
