"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: "รอชำระเงิน", color: "bg-amber-100 text-amber-700" },
  awaiting_verify: { label: "รอตรวจสอบสลิป", color: "bg-blue-100 text-blue-700" },
  confirmed: { label: "ยืนยันแล้ว", color: "bg-green-100 text-green-700" },
  rejected: { label: "สลิปถูกปฏิเสธ", color: "bg-red-100 text-red-700" },
  expired: { label: "หมดเวลา", color: "bg-slate-200 text-slate-600" },
};

function MerchStatusForm() {
  const searchParams = useSearchParams();
  const [orderCode, setOrderCode] = useState(searchParams.get("orderCode") || "");
  const [phone, setPhone] = useState(searchParams.get("phone") || "");
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setResults(null);
    try {
      const params = new URLSearchParams({ phone });
      if (orderCode) params.set("orderCode", orderCode);
      const res = await fetch(`/api/merch/orders/status?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ไม่พบข้อมูลการสั่งซื้อ");
        return;
      }
      if (!data.orders || data.orders.length === 0) {
        setError("ไม่พบการสั่งซื้อที่ผูกกับข้อมูลนี้");
        return;
      }
      setResults(data.orders);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">เช็คสถานะการสั่งซื้อของที่ระลึก</h1>
        <Link href="/merch" className="text-primary-600 hover:underline text-sm">
          ← กลับหน้าสั่งซื้อ
        </Link>
      </div>

      <form onSubmit={search} className="space-y-3 bg-white border rounded-lg p-4 shadow">
        <div>
          <label className="block text-sm font-medium mb-1">รหัสการสั่งซื้อ (ไม่บังคับ)</label>
          <input
            value={orderCode}
            onChange={(e) => setOrderCode(e.target.value.toUpperCase())}
            className="w-full border rounded px-3 py-2"
            placeholder="เช่น AB23CD45"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">เบอร์โทรศัพท์ที่ใช้สั่งซื้อ *</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-primary-600 text-white py-2 font-semibold hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? "กำลังค้นหา..." : "ตรวจสอบ"}
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {results?.map((o) => {
          const status = STATUS_LABEL[o.paymentStatus] || { label: o.paymentStatus, color: "bg-slate-100 text-slate-600" };
          return (
            <div key={o.orderCode} className="bg-white rounded-xl shadow p-4 space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="font-semibold">รหัสการสั่งซื้อ {o.orderCode}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${status.color}`}>{status.label}</span>
              </div>
              <div className="flex flex-col gap-1 border-t pt-2">
                {o.items.map((it: any, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-slate-500">
                      {it.productName}
                      {it.size ? ` (ไซส์ ${it.size})` : ""} × {it.quantity}
                    </span>
                    <span>{(Number(it.unitPrice) * it.quantity).toLocaleString()} บาท</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>ยอดรวม</span>
                <span>{Number(o.totalAmount).toLocaleString()} บาท</span>
              </div>

              {["pending", "awaiting_verify"].includes(o.paymentStatus) && (
                <a
                  href={`/merch/orders/${o.orderCode}/upload-slip?phone=${encodeURIComponent(phone)}`}
                  className="block text-center rounded bg-slate-900 text-white py-2 mt-2 text-sm"
                >
                  {o.paymentStatus === "awaiting_verify" ? "อัปโหลดสลิปใหม่" : "อัปโหลดสลิปโอนเงิน"}
                </a>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

// useSearchParams() requires a Suspense boundary above it for the build's
// static-export pass (Next.js prerender check).
export default function MerchStatusPage() {
  return (
    <Suspense fallback={null}>
      <MerchStatusForm />
    </Suspense>
  );
}
