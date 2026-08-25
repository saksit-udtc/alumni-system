"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import QrCode from "@/app/components/qr-code";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: "รอชำระเงิน", color: "bg-amber-100 text-amber-700" },
  awaiting_verify: { label: "รอตรวจสอบสลิป", color: "bg-blue-100 text-blue-700" },
  confirmed: { label: "ยืนยันแล้ว", color: "bg-green-100 text-green-700" },
  rejected: { label: "สลิปถูกปฏิเสธ", color: "bg-red-100 text-red-700" },
  expired: { label: "หมดเวลาจอง", color: "bg-slate-200 text-slate-600" },
};

function StatusForm() {
  const searchParams = useSearchParams();
  const [bookingCode, setBookingCode] = useState(searchParams.get("bookingCode") || "");
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
    <main className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">เช็คสถานะการจอง</h1>

      <form onSubmit={search} className="space-y-3 bg-white border rounded-lg p-4 shadow">
        <div>
          <label className="block text-sm font-medium mb-1">รหัสการจอง (ไม่บังคับ)</label>
          <input
            value={bookingCode}
            onChange={(e) => setBookingCode(e.target.value.toUpperCase())}
            className="w-full border rounded px-3 py-2"
            placeholder="เช่น AB23CD45"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">เบอร์โทรศัพท์ที่ใช้จอง *</label>
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
        {results?.map((r) => {
          const status = STATUS_LABEL[r.paymentStatus] || { label: r.paymentStatus, color: "bg-slate-100 text-slate-600" };
          return (
            <div key={r.bookingCode} className="bg-white rounded-xl shadow p-4 space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="font-semibold">{r.eventName}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${status.color}`}>{status.label}</span>
              </div>
              <div className="flex justify-between"><span className="text-slate-500">รหัสการจอง</span><span>{r.bookingCode}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">โต๊ะ</span><span>{r.tableNumber}</span></div>
              <div className="flex justify-between">
                <span className="text-slate-500">ประเภท</span>
                <span>{r.bookingType === "full_table" ? "เหมาโต๊ะ" : "จองที่นั่ง"} · {r.seatCount} ที่นั่ง</span>
              </div>
              <div className="flex justify-between"><span className="text-slate-500">ยอดชำระ</span><span>{Number(r.totalAmount).toLocaleString()} บาท</span></div>

              {r.paymentStatus === "confirmed" && r.qrCodeToken && (
                <div className="pt-2 border-t mt-2 flex flex-col items-center gap-2">
                  {r.checkedIn ? (
                    <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-center w-full">
                      <p className="font-semibold text-sm">เช็คอินแล้ว ✓</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-slate-500">แสดง QR Code นี้ที่จุดลงทะเบียนหน้างาน</p>
                      <div className="p-2 bg-white border rounded-lg">
                        <QrCode value={`checkin:${r.qrCodeToken}`} size={180} />
                      </div>
                    </>
                  )}
                </div>
              )}

              {["pending", "awaiting_verify"].includes(r.paymentStatus) && (
                <a
                  href={`/reservations/${r.bookingCode}/upload-slip?phone=${encodeURIComponent(phone)}`}
                  className="block text-center rounded bg-slate-900 text-white py-2 mt-2 text-sm"
                >
                  {r.paymentStatus === "awaiting_verify" ? "อัปโหลดสลิปใหม่" : "อัปโหลดสลิปโอนเงิน"}
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
// static-export pass (Next.js prerender check) — without this, `next build`
// fails with "useSearchParams() should be wrapped in a suspense boundary".
export default function StatusPage() {
  return (
    <Suspense fallback={null}>
      <StatusForm />
    </Suspense>
  );
}
