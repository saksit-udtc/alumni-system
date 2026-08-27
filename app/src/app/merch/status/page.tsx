"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import SiteNav from "@/app/components/site-nav";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: "รอชำระเงิน", color: "bg-amber-100 text-amber-700" },
  awaiting_verify: { label: "รอตรวจสอบสลิป", color: "bg-blue-100 text-blue-700" },
  confirmed: { label: "ยืนยันแล้ว", color: "bg-green-100 text-green-700" },
  rejected: { label: "สลิปถูกปฏิเสธ", color: "bg-red-100 text-red-700" },
  expired: { label: "หมดเวลา", color: "bg-slate-200 text-slate-600" },
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function MerchStatusForm() {
  const searchParams = useSearchParams();
  const [orderCode, setOrderCode] = useState(searchParams.get("orderCode") || "");
  const [phone, setPhone] = useState(searchParams.get("phone") || "");
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setResults(null);
    setSearched(true);
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
    <div>
      <SiteNav />

      <section className="relative overflow-hidden bg-maroon-700">
        <div className="relative max-w-6xl mx-auto px-4 py-12 sm:py-16 text-center">
          <span className="inline-block text-xs font-medium tracking-wide uppercase bg-white/10 text-primary-200 rounded-full px-3 py-1 mb-4 border border-primary-400/30">
            ของที่ระลึกงานคืนสู่เหย้า
          </span>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold text-white leading-snug">เช็คสถานะการสั่งซื้อ</h1>
          <p className="mt-3 text-cream-50/80 max-w-xl mx-auto">
            กรอกเบอร์โทรศัพท์ที่ใช้สั่งซื้อเพื่อตรวจสอบสถานะการชำระเงินและการจัดส่ง
          </p>
        </div>
      </section>

      <main className="max-w-md mx-auto p-4 space-y-4">
      <div className="flex justify-end">
        <Link href="/merch" className="text-maroon-700 hover:text-maroon-800 hover:underline text-sm">
          ← กลับหน้าสั่งซื้อ
        </Link>
      </div>

      <form onSubmit={search} className="space-y-3 bg-white border border-cream-200 rounded-xl p-5 shadow-md">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">รหัสการสั่งซื้อ (ไม่บังคับ)</label>
          <input
            value={orderCode}
            onChange={(e) => setOrderCode(e.target.value.toUpperCase())}
            className="w-full border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow"
            placeholder="เช่น AB23CD45"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">เบอร์โทรศัพท์ที่ใช้สั่งซื้อ *</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow"
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-maroon-700 text-white py-2.5 font-semibold hover:bg-maroon-800 transition-colors disabled:opacity-50"
        >
          {loading ? "กำลังค้นหา..." : "ตรวจสอบ"}
        </button>
      </form>

      {!searched && (
        <div className="bg-white rounded-xl border border-dashed border-cream-200 p-10 text-center text-stone-400">
          <div className="flex justify-center text-stone-300">
            <SearchIcon />
          </div>
          <p className="mt-3 text-sm">กรอกเบอร์โทรศัพท์ด้านบนแล้วกด &quot;ตรวจสอบ&quot; เพื่อดูสถานะการสั่งซื้อ</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {results?.map((o) => {
          const status = STATUS_LABEL[o.paymentStatus] || { label: o.paymentStatus, color: "bg-slate-100 text-slate-600" };
          return (
            <div key={o.orderCode} className="bg-white rounded-xl border border-cream-200 border-l-4 border-l-primary-500 shadow-md p-5 space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="font-display font-semibold text-stone-800">รหัสการสั่งซื้อ {o.orderCode}</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.color}`}>{status.label}</span>
              </div>
              <div className="flex flex-col gap-1 border-t border-cream-200 pt-2">
                {o.items.map((it: any, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-stone-500">
                      {it.productName}
                      {it.size ? ` (ไซส์ ${it.size})` : ""} × {it.quantity}
                    </span>
                    <span className="text-stone-700">{(Number(it.unitPrice) * it.quantity).toLocaleString()} บาท</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-semibold text-stone-800 border-t border-cream-200 pt-2">
                <span>ยอดรวม</span>
                <span>{Number(o.totalAmount).toLocaleString()} บาท</span>
              </div>

              {["pending", "awaiting_verify"].includes(o.paymentStatus) && (
                <a
                  href={`/merch/orders/${o.orderCode}/upload-slip?phone=${encodeURIComponent(phone)}`}
                  className="block text-center rounded-lg bg-maroon-700 hover:bg-maroon-800 transition-colors text-white py-2 mt-2 text-sm font-medium"
                >
                  {o.paymentStatus === "awaiting_verify" ? "อัปโหลดสลิปใหม่" : "อัปโหลดสลิปโอนเงิน"}
                </a>
              )}
            </div>
          );
        })}
      </div>
      </main>
    </div>
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
