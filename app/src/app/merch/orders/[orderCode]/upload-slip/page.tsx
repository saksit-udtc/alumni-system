"use client";

import { useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";

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
      <main className="max-w-md mx-auto p-4 text-center bg-white border rounded-lg p-6 space-y-3">
        <h1 className="text-xl font-bold text-green-600 mb-2">อัปโหลดสลิปสำเร็จ</h1>
        <p className="text-gray-600 mb-1">รหัสการสั่งซื้อของท่านคือ {orderCode}</p>
        <p className="text-sm text-gray-500 mb-4">
          แอดมินจะตรวจสอบและยืนยันการชำระเงินโดยเร็วที่สุด ท่านสามารถตรวจสอบสถานะได้ที่หน้าสถานะการสั่งซื้อ
        </p>
        <button
          onClick={() => router.push(`/merch/status?orderCode=${orderCode}&phone=${encodeURIComponent(bookerPhone)}`)}
          className="bg-primary-600 text-white rounded px-4 py-2"
        >
          เช็คสถานะการสั่งซื้อ
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto p-4">
      <h1 className="text-xl font-bold mb-1">อัปโหลดสลิปโอนเงิน</h1>
      <p className="text-sm text-gray-500 mb-4">รหัสการสั่งซื้อ: {orderCode}</p>

      <form onSubmit={submit} className="flex flex-col gap-3 bg-white p-4 rounded-xl shadow">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">เบอร์โทรศัพท์ที่ใช้สั่งซื้อ *</span>
          <input
            value={bookerPhone}
            onChange={(e) => setBookerPhone(e.target.value)}
            className="border rounded px-3 py-2"
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">ไฟล์สลิปโอนเงิน *</span>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="border rounded px-3 py-2"
            required
          />
        </label>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="bg-primary-600 text-white rounded py-2 font-semibold hover:bg-primary-700 disabled:opacity-50"
        >
          {submitting ? "กำลังอัปโหลด..." : "ส่งสลิป"}
        </button>
      </form>
    </main>
  );
}
