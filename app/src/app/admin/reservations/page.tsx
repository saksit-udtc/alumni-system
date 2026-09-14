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
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  awaiting_verify: "bg-amber-50 text-amber-700 border border-amber-200",
  confirmed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  rejected: "bg-red-50 text-red-700 border border-red-200",
  expired: "bg-stone-100 text-stone-500 border border-stone-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block text-xs px-2.5 py-1 rounded-lg font-medium whitespace-nowrap ${
        STATUS_BADGE[status] || "bg-stone-100 text-stone-500 border border-stone-200"
      }`}
    >
      {STATUS_LABEL[status] || status}
    </span>
  );
}

// EasySlip's automated check, shown next to "ดูสลิป" — purely advisory, the
// admin can still approve regardless of this badge (see lib/easyslip.ts).
function EasySlipBadge({ status, message }: { status: string | null; message: string | null }) {
  if (!status || status === "SKIPPED") return null;
  const style =
    status === "MATCH"
      ? "bg-emerald-100 text-emerald-700"
      : status === "ERROR"
      ? "bg-stone-100 text-stone-500"
      : "bg-red-100 text-red-700"; // AMOUNT_MISMATCH, INVALID_SLIP, DUPLICATE
  const label = status === "MATCH" ? "✓ ตรงกับธนาคาร" : status === "ERROR" ? "ตรวจสอบไม่สำเร็จ" : "⚠ ไม่ตรง/น่าสงสัย";
  return (
    <span title={message || ""} className={`block mt-1.5 text-[11px] px-2 py-0.5 rounded-full font-medium w-fit ${style}`}>
      {label}
    </span>
  );
}

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
        <div className="bg-white rounded-2xl border border-dashed border-cream-200 p-10 text-center text-stone-400 text-sm">
          ยังไม่มีการจองโต๊ะเข้ามาในระบบ
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-cream-200/80 shadow-sm bg-white">
          <table className="w-full bg-white text-sm border-collapse">
            <thead>
              <tr className="text-left bg-gradient-to-b from-cream-100 to-cream-50 text-stone-500 text-[11px] font-semibold uppercase tracking-wider">
                <th className="px-4 py-3.5 sticky top-0">รหัส</th>
                <th className="px-4 py-3.5 sticky top-0">งานเลี้ยง</th>
                <th className="px-4 py-3.5 sticky top-0 text-center">โต๊ะ</th>
                <th className="px-4 py-3.5 sticky top-0">ผู้จอง</th>
                <th className="px-4 py-3.5 sticky top-0">สถานะ</th>
                <th className="px-4 py-3.5 sticky top-0">สลิป</th>
                <th className="px-4 py-3.5 sticky top-0">เช็คอิน</th>
                <th className="px-4 py-3.5 sticky top-0">ของที่ระลึก</th>
                <th className="px-4 py-3.5 sticky top-0">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {reservations.map((r) => (
                <tr key={r.id} className="hover:bg-primary-50/50 transition-colors align-top">
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-xs bg-stone-100 text-stone-600 px-2 py-1 rounded-md">{r.bookingCode}</span>
                  </td>
                  <td className="px-4 py-3.5 text-stone-600 text-xs max-w-[10rem]">{r.eventName}</td>
                  <td className="px-4 py-3.5 text-stone-700 text-center font-medium tabular-nums">{r.tableNumber}</td>
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-stone-800">{r.bookerName}</div>
                    <div className="text-xs text-stone-400">{r.bookerPhone}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={r.paymentStatus} />
                  </td>
                  <td className="px-4 py-3.5">
                    {r.latestSlipUrl ? (
                      <a
                        href={r.latestSlipUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block whitespace-nowrap text-xs px-2.5 py-1.5 rounded-lg font-medium bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-colors"
                      >
                        ดูสลิป
                      </a>
                    ) : (
                      <span className="inline-block whitespace-nowrap text-xs px-2.5 py-1.5 rounded-lg font-medium bg-stone-100 text-stone-400 border border-stone-200">ไม่มี</span>
                    )}
                    <EasySlipBadge status={r.latestSlipEasyslipStatus} message={r.latestSlipEasyslipMessage} />
                  </td>
                  <td className="px-4 py-3.5">
                    {r.checkedIn ? (
                      <span className="inline-block whitespace-nowrap text-xs px-2.5 py-1 rounded-lg font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        เช็คอินแล้ว
                      </span>
                    ) : (
                      <span className="inline-block whitespace-nowrap text-xs px-2.5 py-1 rounded-lg font-medium bg-stone-100 text-stone-400 border border-stone-200">
                        ยังไม่เช็คอิน
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {r.paymentStatus === "confirmed" && (
                      <button
                        onClick={() => toggleSouvenir(r.id)}
                        disabled={busyId === r.id}
                        className={`whitespace-nowrap text-xs px-2.5 py-1.5 rounded-lg font-medium border transition-colors disabled:opacity-50 ${
                          r.souvenirGiven
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100"
                        }`}
                      >
                        {r.souvenirGiven ? "รับแล้ว" : "ยังไม่รับ"}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {["pending", "awaiting_verify"].includes(r.paymentStatus) && (
                        <>
                          <button
                            onClick={() => act(r.id, "approve")}
                            disabled={busyId === r.id}
                            className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors font-medium disabled:opacity-50"
                          >
                            อนุมัติ
                          </button>
                          <button
                            onClick={() => act(r.id, "reject")}
                            disabled={busyId === r.id}
                            className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors font-medium disabled:opacity-50"
                          >
                            ปฏิเสธ
                          </button>
                        </>
                      )}
                      {r.paymentStatus === "confirmed" && (
                        <button
                          onClick={() => act(r.id, "unconfirm")}
                          disabled={busyId === r.id}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors font-medium disabled:opacity-50"
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
