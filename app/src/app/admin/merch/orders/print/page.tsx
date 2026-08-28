"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = {
  pending: "รอชำระเงิน",
  awaiting_verify: "รอตรวจสอบสลิป",
  confirmed: "ยืนยันแล้ว",
  rejected: "ปฏิเสธ",
  expired: "หมดเวลา",
};

export default function PrintMerchShippingPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [onlyConfirmed, setOnlyConfirmed] = useState(true);

  useEffect(() => {
    fetch("/api/admin/merch/orders")
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []));
  }, []);

  const visibleOrders = useMemo(
    () => (onlyConfirmed ? orders.filter((o) => o.paymentStatus === "confirmed") : orders),
    [orders, onlyConfirmed]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div>
          <h1 className="text-2xl font-display font-semibold text-stone-800">ปริ้นที่อยู่จัดส่ง</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            แสดง {visibleOrders.length} รายการ — ตรวจสอบก่อนกดพิมพ์
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-stone-600">
            <input
              type="checkbox"
              checked={onlyConfirmed}
              onChange={(e) => setOnlyConfirmed(e.target.checked)}
            />
            เฉพาะที่ยืนยันแล้ว
          </label>
          <Link
            href="/admin/merch/orders"
            className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors"
          >
            กลับ
          </Link>
          <button
            onClick={() => window.print()}
            className="bg-primary-700 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary-800 transition-colors"
          >
            พิมพ์
          </button>
        </div>
      </div>

      {visibleOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-cream-200 p-10 text-center text-stone-400 text-sm print:hidden">
          ไม่มีรายการที่จะพิมพ์
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2 print:gap-3">
          {visibleOrders.map((o) => (
            <div
              key={o.id}
              className="border border-stone-300 rounded-lg p-4 break-inside-avoid print:border-black"
            >
              <div className="text-xs text-stone-400 mb-1">
                คำสั่งซื้อ {o.orderCode} · {STATUS_LABEL[o.paymentStatus] || o.paymentStatus}
              </div>
              <div className="text-base font-semibold text-stone-800">ผู้รับ: {o.bookerName}</div>
              <div className="text-sm text-stone-700">โทร: {o.bookerPhone}</div>
              <div className="text-sm text-stone-700 whitespace-pre-wrap mt-1">{o.shippingAddress}</div>
              <div className="text-xs text-stone-400 mt-2 border-t border-dashed border-stone-300 pt-1">
                {o.items
                  .map((it: any) => `${it.productName}${it.size ? ` (${it.size})` : ""} x${it.quantity}`)
                  .join(", ")}
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx global>{`
        @media print {
          @page {
            margin: 12mm;
          }
          nav,
          header,
          aside {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
