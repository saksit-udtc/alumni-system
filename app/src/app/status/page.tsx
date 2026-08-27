"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import QrCode from "@/app/components/qr-code";
import SiteNav from "@/app/components/site-nav";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: "รอชำระเงิน", color: "bg-amber-100 text-amber-700" },
  awaiting_verify: { label: "รอตรวจสอบสลิป", color: "bg-blue-100 text-blue-700" },
  confirmed: { label: "ยืนยันแล้ว", color: "bg-green-100 text-green-700" },
  rejected: { label: "สลิปถูกปฏิเสธ", color: "bg-red-100 text-red-700" },
  expired: { label: "หมดเวลาจอง", color: "bg-slate-200 text-slate-600" },
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function StatusForm() {
  const searchParams = useSearchParams();
  const [bookingCode, setBookingCode] = useState(searchParams.get("bookingCode") || "");
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
      if (bookingCode) params.set("bookingCode", bookingCode);
      const res = await fetch(`/api/reservations/status?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ไม่พบข้อมูลการจอง");
        return;
      }
      if (!data.reservations || data.reservations.length === 0) {
        setError("ไม่พบการจองที่ผูกกับข้อมูลนี้");
        return;
      }
      setResults(data.reservations);
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
            ตรวจสอบการจอง
          </span>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold text-white leading-snug">เช็คสถานะการจอง</h1>
          <p className="mt-3 text-cream-50/80 max-w-xl mx-auto">
            กรอกเบอร์โทรศัพท์ที่ใช้จองเพื่อตรวจสอบสถานะและดู QR Code เช็คอิน
          </p>
        </div>
      </section>

      <main className="max-w-md mx-auto p-4 space-y-5">
      <form onSubmit={search} className="space-y-3 bg-white border border-cream-200 rounded-xl p-5 shadow-md">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">รหัสการจอง (ไม่บังคับ)</label>
          <input
            value={bookingCode}
            onChange={(e) => setBookingCode(e.target.value.toUpperCase())}
            className="w-full border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow"
            placeholder="เช่น AB23CD45"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">เบอร์โทรศัพท์ที่ใช้จอง *</label>
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
          <p className="mt-3 text-sm">กรอกเบอร์โทรศัพท์ด้านบนแล้วกด &quot;ตรวจสอบ&quot; เพื่อดูสถานะการจอง</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {results?.map((r) => {
          const status = STATUS_LABEL[r.paymentStatus] || { label: r.paymentStatus, color: "bg-slate-100 text-slate-600" };
          return (
            <div key={r.bookingCode} className="bg-white rounded-xl border border-cream-200 border-l-4 border-l-primary-500 shadow-md p-5 space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="font-display font-semibold text-stone-800">{r.eventName}</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.color}`}>{status.label}</span>
              </div>
              <div className="flex justify-between"><span className="text-stone-500">รหัสการจอง</span><span className="font-medium">{r.bookingCode}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">โต๊ะ</span><span className="font-medium">{r.tableNumber}</span></div>
              <div className="flex justify-between">
                <span className="text-stone-500">ประเภท</span>
                <span className="font-medium">{r.bookingType === "full_table" ? "เหมาโต๊ะ" : "จองที่นั่ง"} · {r.seatCount} ที่นั่ง</span>
              </div>
              <div className="flex justify-between"><span className="text-stone-500">ยอดชำระ</span><span className="font-medium">{Number(r.totalAmount).toLocaleString()} บาท</span></div>

              {r.paymentStatus === "confirmed" && r.qrCodeToken && (
                <div className="pt-3 border-t border-cream-200 mt-2 flex flex-col items-center gap-2">
                  {r.checkedIn ? (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-3 text-center w-full">
                      <p className="font-semibold text-sm">เช็คอินแล้ว ✓</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-stone-500">แสดง QR Code นี้ที่จุดลงทะเบียนหน้างาน</p>
                      <div className="p-2 bg-white border border-cream-200 rounded-lg">
                        <QrCode value={`checkin:${r.qrCodeToken}`} size={180} />
                      </div>
                    </>
                  )}
                </div>
              )}

              {["pending", "awaiting_verify"].includes(r.paymentStatus) && (
                <a
                  href={`/reservations/${r.bookingCode}/upload-slip?phone=${encodeURIComponent(phone)}`}
                  className="block text-center rounded-lg bg-maroon-700 hover:bg-maroon-800 transition-colors text-white py-2 mt-2 text-sm font-medium"
                >
                  {r.paymentStatus === "awaiting_verify" ? "อัปโหลดสลิปใหม่" : "อัปโหลดสลิปโอนเงิน"}
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
// static-export pass (Next.js prerender check) — without this, `next build`
// fails with "useSearchParams() should be wrapped in a suspense boundary".
export default function StatusPage() {
  return (
    <Suspense fallback={null}>
      <StatusForm />
    </Suspense>
  );
}
