"use client";

import { useEffect, useState } from "react";
import { AdminStatCard } from "@/app/components/admin-stat-card";

const STATUS_LABEL: Record<string, string> = {
  pending: "รอชำระเงิน",
  awaiting_verify: "รอตรวจสอบสลิป",
  confirmed: "ยืนยันแล้ว",
  rejected: "ปฏิเสธ",
  expired: "หมดเวลา",
};
const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  awaiting_verify: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-stone-200 text-stone-600",
};

/**
 * All-events reservations view — mirrors /admin/merch/orders' shape
 * (dashboard summary cards + table + inline approve/reject actions) so
 * FINANCE_STAFF, whose menu is limited to "รายการจอง" and "รายการสั่งซื้อของ
 * ที่ระลึก", gets one consistent page pattern for both. Reservation actions
 * hit the same /api/admin/reservations/[id]/* endpoints the per-event page
 * uses.
 */
export default function AdminAllReservationsPage() {
  const [reservations, setReservations] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/reservations")
      .then((r) => r.json())
      .then((d) => setReservations(d.reservations || []));
  }
  useEffect(load, []);

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

  const pendingCount = reservations.filter((r) => ["pending", "awaiting_verify"].includes(r.paymentStatus)).length;
  const confirmedReservations = reservations.filter((r) => r.paymentStatus === "confirmed");
  const confirmedRevenue = confirmedReservations.reduce((sum, r) => sum + Number(r.totalAmount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-display font-semibold text-stone-800">รายการจอง</h1>
          <p className="text-sm text-stone-500 mt-0.5">ตรวจสอบสลิปและอนุมัติการจองโต๊ะทั้งหมดทุกงานเลี้ยง</p>
        </div>
        <a
          href="/api/admin/reservations/export"
          className="bg-white border border-stone-300 shadow-sm rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-cream-50 transition-colors"
        >
          Export Excel
        </a>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <AdminStatCard icon="ticket" label="การจองทั้งหมด" value={String(reservations.length)} tone="violet" />
        <AdminStatCard icon="clock" label="รอตรวจสอบ" value={String(pendingCount)} tone="amber" />
        <AdminStatCard icon="checkin" label="ยืนยันแล้ว" value={String(confirmedReservations.length)} tone="emerald" />
        <AdminStatCard icon="coin" label="ยอดชำระยืนยันแล้ว" value={`${confirmedRevenue.toLocaleString()} บาท`} tone="sky" />
      </div>

      {reservations.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-cream-200 p-10 text-center text-stone-400 text-sm">
          ยังไม่มีการจองโต๊ะเข้ามาในระบบ
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-cream-200 shadow-md">
          <table className="w-full bg-white text-sm">
            <thead>
              <tr className="text-left bg-cream-100 text-stone-500 text-xs uppercase tracking-wide">
                <th className="p-3 font-semibold">รหัส</th>
                <th className="p-3 font-semibold">งานเลี้ยง</th>
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
              {reservations.map((r, idx) => (
                <tr
                  key={r.id}
                  className={`border-t border-cream-100 hover:bg-primary-50/60 transition-colors align-top ${idx % 2 === 1 ? "bg-cream-100" : "bg-white"}`}
                >
                  <td className="p-3 font-mono text-stone-700">{r.bookingCode}</td>
                  <td className="p-3 text-stone-600 text-xs">{r.eventName}</td>
                  <td className="p-3 text-stone-700">{r.tableNumber}</td>
                  <td className="p-3">
                    <div className="font-medium text-stone-800">{r.bookerName}</div>
                    <div className="text-xs text-stone-400">{r.bookerPhone}</div>
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[r.paymentStatus] || "bg-stone-200 text-stone-600"}`}>
                      {STATUS_LABEL[r.paymentStatus] || r.paymentStatus}
                    </span>
                  </td>
                  <td className="p-3">
                    {r.latestSlipUrl ? (
                      <a
                        href={r.latestSlipUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs px-2.5 py-1 rounded-full font-medium bg-sky-100 text-sky-700 hover:bg-sky-200 transition-colors"
                      >
                        ดูสลิป
                      </a>
                    ) : (
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-stone-100 text-stone-400">ไม่มี</span>
                    )}
                  </td>
                  <td className="p-3">
                    {r.checkedIn ? (
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-100 text-emerald-700">เช็คอินแล้ว</span>
                    ) : (
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-stone-100 text-stone-400">ยังไม่เช็คอิน</span>
                    )}
                  </td>
                  <td className="p-3">
                    {r.paymentStatus === "confirmed" && (
                      <button
                        onClick={() => toggleSouvenir(r.id)}
                        disabled={busyId === r.id}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${r.souvenirGiven ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-stone-100 text-stone-500 hover:bg-stone-200"}`}
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
      )}
    </div>
  );
}
