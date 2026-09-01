"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminStatCard } from "@/app/components/admin-stat-card";

const STATUS_LABEL: Record<string, string> = {
  pending: "รอชำระเงิน",
  awaiting_verify: "รอตรวจสอบสลิป",
  confirmed: "ยืนยันแล้ว",
  rejected: "ปฏิเสธ",
  expired: "หมดเวลา",
};
const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  awaiting_verify: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-stone-200 text-stone-600",
};

export default function AdminMerchOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

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

  function startEditAddress(orderId: string, currentAddress: string) {
    setEditingId(orderId);
    setEditValue(currentAddress);
  }

  function cancelEditAddress() {
    setEditingId(null);
    setEditValue("");
  }

  async function saveAddress(orderId: string) {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/merch/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingAddress: editValue }),
      });
      if (res.ok) {
        setEditingId(null);
        setEditValue("");
        load();
      }
    } finally {
      setSavingEdit(false);
    }
  }

  const pendingCount = orders.filter((o) => ["pending", "awaiting_verify"].includes(o.paymentStatus)).length;
  const confirmedOrders = orders.filter((o) => o.paymentStatus === "confirmed");
  const confirmedRevenue = confirmedOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-display font-semibold text-stone-800">รายการสั่งซื้อของที่ระลึก</h1>
          <p className="text-sm text-stone-500 mt-0.5">ตรวจสอบสลิปและอนุมัติคำสั่งซื้อของที่ระลึกทั้งหมด</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/merch/orders/print"
            className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors"
          >
            ปริ้นที่อยู่จัดส่ง
          </Link>
          <a
            href="/api/admin/merch/orders/export"
            className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors"
          >
            Export Excel
          </a>
          <Link href="/admin/merch/products" className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors">
            จัดการสินค้า
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <AdminStatCard icon="bag" label="คำสั่งซื้อทั้งหมด" value={String(orders.length)} tone="violet" />
        <AdminStatCard icon="clock" label="รอตรวจสอบ" value={String(pendingCount)} tone="amber" />
        <AdminStatCard icon="checkin" label="ยืนยันแล้ว" value={String(confirmedOrders.length)} tone="emerald" />
        <AdminStatCard icon="coin" label="ยอดขายยืนยันแล้ว" value={`${confirmedRevenue.toLocaleString()} บาท`} tone="sky" />
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-cream-200 p-10 text-center text-stone-400 text-sm">
          ยังไม่มีคำสั่งซื้อของที่ระลึกเข้ามาในระบบ
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-cream-200 shadow-md">
          <table className="w-full bg-white text-sm">
            <thead>
              <tr className="text-left bg-cream-100 text-stone-500 text-xs uppercase tracking-wide">
                <th className="p-3 font-semibold">รหัส</th>
                <th className="p-3 font-semibold">ผู้สั่ง</th>
                <th className="p-3 font-semibold">ที่อยู่จัดส่ง</th>
                <th className="p-3 font-semibold">รายการ</th>
                <th className="p-3 font-semibold">ยอดรวม</th>
                <th className="p-3 font-semibold">สถานะ</th>
                <th className="p-3 font-semibold">สลิป</th>
                <th className="p-3 font-semibold">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, idx) => (
                <tr
                  key={o.id}
                  className={`border-t border-cream-100 hover:bg-primary-50/60 transition-colors align-top ${idx % 2 === 1 ? "bg-cream-100" : "bg-white"}`}
                >
                  <td className="p-3 font-mono text-stone-700">{o.orderCode}</td>
                  <td className="p-3">
                    <div className="font-medium text-stone-800">{o.bookerName}</div>
                    <div className="text-xs text-stone-400">{o.bookerPhone}</div>
                    <div className="text-xs text-stone-400">{o.bookerEmail}</div>
                  </td>
                  <td className="p-3 max-w-[16rem] text-xs text-stone-600">
                    {editingId === o.id ? (
                      <div className="space-y-1.5">
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          rows={3}
                          className="w-full text-xs border border-stone-300 rounded-md p-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => saveAddress(o.id)}
                            disabled={savingEdit || !editValue.trim()}
                            className="text-xs px-2 py-1 rounded-md bg-primary-700 text-white hover:bg-primary-800 transition-colors disabled:opacity-50"
                          >
                            บันทึก
                          </button>
                          <button
                            onClick={cancelEditAddress}
                            disabled={savingEdit}
                            className="text-xs px-2 py-1 rounded-md bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="whitespace-pre-wrap">{o.shippingAddress}</div>
                        <button
                          onClick={() => startEditAddress(o.id, o.shippingAddress)}
                          className="text-primary-700 hover:text-primary-800 hover:underline"
                        >
                          แก้ไข
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    {o.items.map((it: any, i: number) => (
                      <div key={i} className="text-xs text-stone-600">
                        {it.productName}
                        {it.size ? ` (${it.size})` : ""} × {it.quantity}
                      </div>
                    ))}
                  </td>
                  <td className="p-3 text-stone-700">{Number(o.totalAmount).toLocaleString()} บาท</td>
                  <td className="p-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[o.paymentStatus] || "bg-stone-200 text-stone-600"}`}>
                      {STATUS_LABEL[o.paymentStatus] || o.paymentStatus}
                    </span>
                  </td>
                  <td className="p-3">
                    {o.latestSlipUrl ? (
                      <a
                        href={o.latestSlipUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs px-2.5 py-1 rounded-full font-medium bg-sky-100 text-sky-700 hover:bg-sky-200 transition-colors"
                      >
                        ดูสลิป
                      </a>
                    ) : (
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-stone-100 text-stone-400">ไม่มี</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {["pending", "awaiting_verify"].includes(o.paymentStatus) && (
                        <>
                          <button
                            onClick={() => act(o.id, "approve")}
                            disabled={busyId === o.id}
                            className="text-xs px-2.5 py-1.5 rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors font-medium"
                          >
                            อนุมัติ
                          </button>
                          <button
                            onClick={() => act(o.id, "reject")}
                            disabled={busyId === o.id}
                            className="text-xs px-2.5 py-1.5 rounded-md bg-red-100 text-red-700 hover:bg-red-200 transition-colors font-medium"
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
      )}
    </div>
  );
}
