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
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold">รายการจอง</h1>
        <a
          href={`/api/admin/events/${id}/reservations/export`}
          className="bg-white shadow rounded px-3 py-2 text-sm hover:bg-gray-50"
        >
          ⬇️ ส่งออก CSV
        </a>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full bg-white rounded-xl shadow text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">รหัส</th>
              <th className="p-2">โต๊ะ</th>
              <th className="p-2">ผู้จอง</th>
              <th className="p-2">สถานะ</th>
              <th className="p-2">สลิป</th>
              <th className="p-2">เช็คอิน</th>
              <th className="p-2">ของที่ระลึก</th>
              <th className="p-2">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => (
              <tr key={r.id} className="border-b align-top">
                <td className="p-2 font-mono">{r.bookingCode}</td>
                <td className="p-2">{r.tableNumber}</td>
                <td className="p-2">
                  <div>{r.bookerName}</div>
                  <div className="text-xs text-gray-400">{r.bookerPhone}</div>
                </td>
                <td className="p-2">{STATUS_LABEL[r.paymentStatus] || r.paymentStatus}</td>
                <td className="p-2">
                  {r.latestSlipUrl ? (
                    <a href={r.latestSlipUrl} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">
                      ดูสลิป
                    </a>
                  ) : (
                    <span className="text-gray-300">ไม่มี</span>
                  )}
                </td>
                <td className="p-2">{r.checkedIn ? "✅" : "—"}</td>
                <td className="p-2">
                  {r.paymentStatus === "confirmed" && (
                    <button
                      onClick={() => toggleSouvenir(r.id)}
                      disabled={busyId === r.id}
                      className={`text-xs px-2 py-1 rounded ${r.souvenirGiven ? "bg-green-100 text-green-700" : "bg-gray-100"}`}
                    >
                      {r.souvenirGiven ? "รับแล้ว" : "ยังไม่รับ"}
                    </button>
                  )}
                </td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1.5">
                    {["pending", "awaiting_verify"].includes(r.paymentStatus) && (
                      <>
                        <button
                          onClick={() => act(r.id, "approve")}
                          disabled={busyId === r.id}
                          className="text-xs px-2 py-1.5 rounded bg-green-100 text-green-700"
                        >
                          อนุมัติ
                        </button>
                        <button
                          onClick={() => act(r.id, "reject")}
                          disabled={busyId === r.id}
                          className="text-xs px-2 py-1.5 rounded bg-red-100 text-red-700"
                        >
                          ปฏิเสธ
                        </button>
                      </>
                    )}
                    {r.paymentStatus === "confirmed" && (
                      <button
                        onClick={() => act(r.id, "unconfirm")}
                        disabled={busyId === r.id}
                        className="text-xs px-2 py-1.5 rounded bg-yellow-100 text-yellow-700"
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
