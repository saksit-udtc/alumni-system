"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = {
  pending: "รอชำระเงิน",
  awaiting_verify: "รอตรวจสอบสลิป",
  confirmed: "ยืนยันแล้ว",
  rejected: "ปฏิเสธ",
  expired: "หมดเวลา",
};

export default function AdminMerchOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/merch/orders")
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []));
  }
  useEffect(load, []);

  async function act(orderId: string, action: "approve" | "reject", note?: string) {
    setBusyId(orderId);
    try {
      await fetch(`/api/admin/merch/orders/${orderId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold">รายการสั่งซื้อของที่ระลึก</h1>
        <Link href="/admin/merch/products" className="bg-white shadow rounded px-3 py-2 text-sm hover:bg-gray-50">
          จัดการสินค้า
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full bg-white rounded-xl shadow text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">รหัส</th>
              <th className="p-2">ผู้สั่ง</th>
              <th className="p-2">ที่อยู่จัดส่ง</th>
              <th className="p-2">รายการ</th>
              <th className="p-2">ยอดรวม</th>
              <th className="p-2">สถานะ</th>
              <th className="p-2">สลิป</th>
              <th className="p-2">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b align-top">
                <td className="p-2 font-mono">{o.orderCode}</td>
                <td className="p-2">
                  <div>{o.bookerName}</div>
                  <div className="text-xs text-gray-400">{o.bookerPhone}</div>
                  <div className="text-xs text-gray-400">{o.bookerEmail}</div>
                </td>
                <td className="p-2 max-w-[16rem] whitespace-pre-wrap text-xs text-gray-600">
                  {o.shippingAddress}
                </td>
                <td className="p-2">
                  {o.items.map((it: any, i: number) => (
                    <div key={i} className="text-xs">
                      {it.productName}
                      {it.size ? ` (${it.size})` : ""} × {it.quantity}
                    </div>
                  ))}
                </td>
                <td className="p-2">{Number(o.totalAmount).toLocaleString()} บาท</td>
                <td className="p-2">{STATUS_LABEL[o.paymentStatus] || o.paymentStatus}</td>
                <td className="p-2">
                  {o.latestSlipUrl ? (
                    <a href={o.latestSlipUrl} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">
                      ดูสลิป
                    </a>
                  ) : (
                    <span className="text-gray-300">ไม่มี</span>
                  )}
                </td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1.5">
                    {["pending", "awaiting_verify"].includes(o.paymentStatus) && (
                      <>
                        <button
                          onClick={() => act(o.id, "approve")}
                          disabled={busyId === o.id}
                          className="text-xs px-2 py-1.5 rounded bg-green-100 text-green-700"
                        >
                          อนุมัติ
                        </button>
                        <button
                          onClick={() => act(o.id, "reject")}
                          disabled={busyId === o.id}
                          className="text-xs px-2 py-1.5 rounded bg-red-100 text-red-700"
                        >
                          ปฏิเสธ
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
