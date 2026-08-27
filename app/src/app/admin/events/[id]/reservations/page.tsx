"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const STATUS_LABEL: Record<string, string> = {
  pending: "รอชำระเงิน",
  awaiting_verify: "รอตรวจสอบสลิป",
  confirmed: "ยืนยันแล้ว",
  rejected: "ปฏิเสธ",
  expired: "หมดเวลา",
};

export default function AdminReservationsPage() {
  const { id } = useParams<{ id: string }>();
  const [reservations, setReservations] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    fetch(`/api/admin/events/${id}/reservations`)
      .then((r) => r.json())
      .then((d) => setReservations(d.reservations || []));
  }
  useEffect(load, [id]);

  async function act(reservationId: string, action: "approve" | "reject" | "unconfirm", note?: string) {
    setBusyId(reservationId);
    try {
      await fetch(`/api/admin/reservations/${reservationId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function toggleSouvenir(reservationId: string) {
    setBusyId(reservationId);
    try {
      await fetch(`/api/admin/reservations/${reservationId}/souvenir`, { method: "POST" });
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <h1 className="text-2xl font-display font-semibold text-stone-800">รายการจอง</h1>
        <a
          href={`/api/admin/events/${id}/reservations/export`}
          className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors"
        >
          ⬇️ ส่งออก CSV
        </a>
      </div>

      <div className="overflow-x-auto rounded-xl border border-cream-200 shadow-md">
        <table className="w-full bg-white text-sm">
          <thead>
            <tr className="text-left bg-cream-100 text-stone-500 text-xs uppercase tracking-wide">
              <th className="p-3 font-semibold">รหัส</th>
              <th className="p-3 font-semibold">โต๊ะ</th>
              <th className="p-3 font-semibold">ผู้จอง</th>
              <th className="p-3 font-semibold">สถานะ</th>
              <th className="p-3 font-semibold">สลิป</th>
              <th className="p-3 font-semibold">เช็คอิน</th>
              <th className="p-3 font-semibold">ของที่ระลึก</th>
              <th className="p-3 font-semibold">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => (
              <tr key={r.id} className="border-t border-cream-100 hover:bg-cream-50/60 transition-colors align-top">
                <td className="p-3 font-mono text-stone-700">{r.bookingCode}</td>
                <td className="p-3 text-stone-700">{r.tableNumber}</td>
                <td className="p-3">
                  <div className="font-medium text-stone-800">{r.bookerName}</div>
                  <div className="text-xs text-stone-400">{r.bookerPhone}</div>
                </td>
                <td className="p-3 text-stone-700">{STATUS_LABEL[r.paymentStatus] || r.paymentStatus}</td>
                <td className="p-3">
                  {r.latestSlipUrl ? (
                    <a href={r.latestSlipUrl} target="_blank" rel="noreferrer" className="text-primary-700 hover:text-primary-800 hover:underline">
                      ดูสลิป
                    </a>
                  ) : (
                    <span className="text-stone-300">ไม่มี</span>
                  )}
                </td>
                <td className="p-3">{r.checkedIn ? "✅" : "—"}</td>
                <td className="p-3">
                  {r.paymentStatus === "confirmed" && (
                    <button
                      onClick={() => toggleSouvenir(r.id)}
                      disabled={busyId === r.id}
                      className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${r.souvenirGiven ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
                    >
                      {r.souvenirGiven ? "รับแล้ว" : "ยังไม่รับ"}
                    </button>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {["pending", "awaiting_verify"].includes(r.paymentStatus) && (
                      <>
                        <button
                          onClick={() => act(r.id, "approve")}
                          disabled={busyId === r.id}
                          className="text-xs px-2.5 py-1.5 rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors font-medium"
                        >
                          อนุมัติ
                        </button>
                        <button
                          onClick={() => act(r.id, "reject")}
                          disabled={busyId === r.id}
                          className="text-xs px-2.5 py-1.5 rounded-md bg-red-100 text-red-700 hover:bg-red-200 transition-colors font-medium"
                        >
                          ปฏิเสธ
                        </button>
                      </>
                    )}
                    {r.paymentStatus === "confirmed" && (
                      <button
                        onClick={() => act(r.id, "unconfirm")}
                        disabled={busyId === r.id}
                        className="text-xs px-2.5 py-1.5 rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors font-medium"
                      >
                        ยกเลิกยืนยัน
                      </button>
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
