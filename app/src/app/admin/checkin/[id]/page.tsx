"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function AdminCheckinDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [reservation, setReservation] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function load() {
    fetch(`/api/admin/checkin/${id}`)
      .then((r) => r.json())
      .then((d) => setReservation(d.reservation));
  }
  useEffect(load, [id]);

  async function checkin() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/checkin/${id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error);
        return;
      }
      setMessage("เช็คอินสำเร็จ");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleSouvenir() {
    setBusy(true);
    try {
      await fetch(`/api/admin/reservations/${reservation.id}/souvenir`, { method: "POST" });
      load();
    } finally {
      setBusy(false);
    }
  }

  if (!reservation) return <p>กำลังโหลด...</p>;

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-bold mb-1">{reservation.bookerName}</h1>
      <p className="text-sm text-gray-500 mb-4">
        {reservation.bookingCode} · โต๊ะ {reservation.table.tableNumber} · {reservation.event.name}
      </p>

      <div className="bg-white rounded-xl shadow p-4 flex flex-col gap-3">
        <div>
          สถานะการชำระเงิน:{" "}
          <span className={reservation.paymentStatus === "confirmed" ? "text-green-600" : "text-gray-500"}>
            {reservation.paymentStatus}
          </span>
        </div>
        <div>เช็คอิน: {reservation.checkedIn ? `✅ เมื่อ ${new Date(reservation.checkedInAt).toLocaleString("th-TH")}` : "ยังไม่เช็คอิน"}</div>
        <div>ของที่ระลึก: {reservation.souvenirGiven ? "✅ รับแล้ว" : "ยังไม่รับ"}</div>

        {message && <p className="text-sm text-primary-600">{message}</p>}

        {!reservation.checkedIn && reservation.paymentStatus === "confirmed" && (
          <button onClick={checkin} disabled={busy} className="bg-primary-600 text-white rounded py-2 disabled:opacity-50">
            ยืนยันเช็คอิน
          </button>
        )}
        {reservation.paymentStatus === "confirmed" && (
          <button onClick={toggleSouvenir} disabled={busy} className="bg-gray-100 rounded py-2">
            {reservation.souvenirGiven ? "ยกเลิกการรับของที่ระลึก" : "มอบของที่ระลึก"}
          </button>
        )}
        {reservation.paymentStatus !== "confirmed" && (
          <p className="text-sm text-red-500">การจองนี้ยังไม่ได้รับการยืนยันการชำระเงิน ไม่สามารถเช็คอินได้</p>
        )}
      </div>
    </div>
  );
}
