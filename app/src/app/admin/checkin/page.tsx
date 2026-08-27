"use client";

import { useState } from "react";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = {
  pending: "รอชำระเงิน",
  awaiting_verify: "รอตรวจสอบสลิป",
  confirmed: "ยืนยันแล้ว",
  rejected: "สลิปถูกปฏิเสธ",
  expired: "หมดเวลา",
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export default function AdminCheckinSearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/checkin/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.reservations || []);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold text-stone-800">ค้นหาเพื่อเช็คอิน</h1>
        <p className="text-sm text-stone-500 mt-0.5">ค้นหาด้วยรหัสการจอง ชื่อผู้จอง หรือเบอร์โทรศัพท์ เพื่อยืนยันเช็คอินหน้างาน</p>
      </div>

      <form onSubmit={search} className="bg-white rounded-xl border border-cream-200 shadow-md p-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="รหัสการจอง / ชื่อ / เบอร์โทร"
          className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-3 py-2 flex-1"
        />
        <button className="bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-lg px-4 py-2 font-medium disabled:opacity-50" disabled={loading}>
          {loading ? "กำลังค้นหา..." : "ค้นหา"}
        </button>
      </form>

      {!searched && (
        <div className="bg-white rounded-xl border border-dashed border-cream-200 p-10 text-center text-stone-400">
          <SearchIcon />
          <p className="mt-3 text-sm">พิมพ์คำค้นหาด้านบนแล้วกด &quot;ค้นหา&quot; เพื่อดูรายการจอง</p>
        </div>
      )}

      {searched && results.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-cream-200 p-10 text-center text-stone-400">
          <p className="text-sm">ไม่พบรายการจองที่ตรงกับ &quot;{q}&quot;</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((r) => (
            <Link
              key={r.id}
              href={`/admin/checkin/${r.id}`}
              className="bg-white rounded-xl border border-cream-200 shadow-md p-4 flex justify-between items-center hover:shadow-md hover:border-primary-300 transition-all"
            >
              <div>
                <div className="font-semibold text-stone-800">{r.bookerName}</div>
                <div className="text-xs text-stone-400">
                  {r.bookingCode} · โต๊ะ {r.table.tableNumber} · {r.event.name}
                </div>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium ${
                  r.paymentStatus === "confirmed" ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"
                }`}
              >
                {STATUS_LABEL[r.paymentStatus] || r.paymentStatus}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
