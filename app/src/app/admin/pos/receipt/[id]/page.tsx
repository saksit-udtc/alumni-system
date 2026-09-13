"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import JsBarcode from "jsbarcode";

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
  items: SaleItem[];
  cashier: { username: string };
}

const PAYMENT_LABEL: Record<string, string> = { cash: "เงินสด", transfer: "โอนเงิน" };

// Narrow 80mm-thermal-receipt-width layout, printed via the browser's own
// print dialog — no separate PDF step, matches how order slips/QR tickets
// are handled elsewhere in this app.
export default function PosReceiptPage({ params }: { params: { id: string } }) {
  const [sale, setSale] = useState<Sale | null>(null);
  const [error, setError] = useState("");
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    fetch(`/api/admin/pos/sales/${params.id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "ไม่พบข้อมูลการขาย");
        setSale(data.sale);
      })
      .catch((e) => setError(e.message || "เกิดข้อผิดพลาด"));
  }, [params.id]);

  useEffect(() => {
    if (!sale || !barcodeRef.current) return;
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

      <div className="max-w-xs mx-auto bg-white border border-cream-200 shadow-md print:shadow-none print:border-0 rounded-lg p-4 font-mono text-sm text-stone-800">
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
        <div className="space-y-1">
          {sale.items.map((it) => (
            <div key={it.id} className="flex justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate">
                  {it.productName}
                  {it.size ? ` (${it.size})` : ""}
                </div>
                <div className="text-xs text-stone-500">
                  {it.quantity} x {Number(it.unitPrice).toLocaleString()}
                </div>
              </div>
              <div className="shrink-0 font-medium">{(it.quantity * Number(it.unitPrice)).toLocaleString()}</div>
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
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:shadow-none,
          .print\\:shadow-none * {
            visibility: visible;
          }
          .print\\:shadow-none {
            position: absolute;
            left: 0;
            top: 0;
          }
        }
      `}</style>
    </div>
  );
}
