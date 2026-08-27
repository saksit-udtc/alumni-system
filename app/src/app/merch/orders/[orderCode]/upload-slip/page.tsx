"use client";

import { useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import SiteNav from "@/app/components/site-nav";

export default function MerchUploadSlipPage() {
  const { orderCode } = useParams<{ orderCode: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [bookerPhone, setBookerPhone] = useState(searchParams.get("phone") || "");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("กรุณาแนบไฟล์สลิปโอนเงิน");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("bookerPhone", bookerPhone);
      formData.append("file", file);

      const res = await fetch(`/api/merch/orders/${orderCode}/upload-slip`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด");
        return;
      }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div>
        <SiteNav />
        <main className="max-w-md mx-auto p-6 text-center bg-white border border-cream-200 rounded-xl shadow-md space-y-3 mt-4">
          <h1 className="text-xl font-display font-semibold text-emerald-600 mb-2">อัปโหลดสลิปสำเร็จ</h1>
          <p className="text-stone-600 mb-1">รหัสการสั่งซื้อของท่านคือ {orderCode}</p>
          <p className="text-sm text-stone-500 mb-4">
            แอดมินจะตรวจสอบและยืนยันการชำระเงินโดยเร็วที่สุด ท่านสามารถตรวจสอบสถานะได้ที่หน้าสถานะการสั่งซื้อ
          </p>
          <button
            onClick={() => router.push(`/merch/status?orderCode=${orderCode}&phone=${encodeURIComponent(bookerPhone)}`)}
            className="bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-lg px-4 py-2 font-medium"
          >
            เช็คสถานะการสั่งซื้อ
          </button>
        </main>
      </div>
    );
  }

  return (
    <div>
      <SiteNav />
      <main className="max-w-md mx-auto p-4">
        <h1 className="text-2xl font-display font-semibold text-stone-800 mb-1">อัปโหลดสลิปโอนเงิน</h1>
        <p className="text-sm text-stone-500 mb-4">รหัสการสั่งซื้อ: {orderCode}</p>

        <form onSubmit={submit} className="flex flex-col gap-3 bg-white p-5 rounded-xl border border-cream-200 shadow-md">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-stone-700">เบอร์โทรศัพท์ที่ใช้สั่งซื้อ *</span>
            <input
              value={bookerPhone}
              onChange={(e) => setBookerPhone(e.target.value)}
              className="border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow"
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-stone-700">ไฟล์สลิปโอนเงิน *</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow"
              required
            />
          </label>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-lg py-2.5 font-semibold disabled:opacity-50"
          >
            {submitting ? "กำลังอัปโหลด..." : "ส่งสลิป"}
          </button>
        </form>
      </main>
    </div>
  );
}
