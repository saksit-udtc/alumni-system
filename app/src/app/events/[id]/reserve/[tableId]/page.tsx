"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import ReserveForm from "./reserve-form";

export default function ReservePage() {
  const { id, tableId } = useParams<{ id: string; tableId: string }>();
  const searchParams = useSearchParams();
  const bookingType = searchParams.get("type") === "full_table" ? "full_table" : "seats";

  const [event, setEvent] = useState<any>(null);
  const [table, setTable] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/events/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          return;
        }
        setEvent(d.event);
        const t = d.tables?.find((x: any) => x.id === tableId);
        setTable(t);
      });
  }, [id, tableId]);

  if (error) return <main className="max-w-md mx-auto p-4 text-red-600">{error}</main>;
  if (!event || !table) return <main className="max-w-md mx-auto p-4">กำลังโหลด...</main>;

  if (event.status !== "open") {
    return <main className="max-w-md mx-auto p-4 text-red-600">งานนี้ปิดรับจองแล้ว</main>;
  }
  if (bookingType === "full_table" && table.seatsReserved !== 0) {
    return <main className="max-w-md mx-auto p-4 text-red-600">โต๊ะนี้มีคนจองบางส่วนแล้ว ไม่สามารถเหมาได้</main>;
  }
  if (bookingType === "seats" && table.isFullTableBooking) {
    return <main className="max-w-md mx-auto p-4 text-red-600">โต๊ะนี้ถูกเหมาไปแล้ว</main>;
  }

  const seatsRemaining = table.seatsAvailable;

  return (
    <main className="max-w-md mx-auto p-4 space-y-4">
      <div>
        <a href={`/events/${id}`} className="text-sm text-blue-600 hover:underline">
          ← กลับไปหน้าจองโต๊ะ
        </a>
        <h1 className="text-xl font-bold mt-1">
          {bookingType === "full_table" ? "เหมาโต๊ะ" : "จองที่นั่ง"} — โต๊ะ {table.tableNumber}
        </h1>
        <p className="text-slate-500 text-sm">{event.name}</p>
      </div>
      <ReserveForm
        eventId={id}
        tableId={tableId}
        bookingType={bookingType}
        capacity={table.capacity}
        seatsRemaining={seatsRemaining}
        pricePerTable={Number(event.pricePerTable)}
        pricePerSeat={Number(event.pricePerSeat)}
      />
    </main>
  );
}
