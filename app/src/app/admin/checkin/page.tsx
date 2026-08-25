"use client";

import { useState } from "react";
import Link from "next/link";

export default function AdminCheckinSearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/checkin/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.reservations || []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold mb-4">ค้นหาเพื่อเช็คอิน</h1>
      <form onSubmit={search} className="flex gap-2 mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="รหัสการจอง / ชื่อ / เบอร์โทร"
          className="border rounded px-3 py-2 flex-1"
        />
        <button className="bg-primary-600 text-white rounded px-4 py-2" disabled={loading}>
          ค้นหา
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {results.map((r) => (
          <Link
            key={r.id}
            href={`/admin/checkin/${r.id}`}
            className="bg-white rounded-lg shadow p-3 flex justify-between items-center hover:bg-gray-50"
          >
            <div>
              <div className="font-semibold">{r.bookerName}</div>
              <div className="text-xs text-gray-400">
                {r.bookingCode} · โต๊ะ {r.table.tableNumber} · {r.event.name}
              </div>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                r.paymentStatus === "confirmed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              {r.paymentStatus}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
