"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import ReserveForm from "./reserve-form";
import SiteNav from "@/app/components/site-nav";

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

  let content: React.ReactNode;

  if (error) {
    content = <p className="text-red-600">{error}</p>;
  } else if (!event || !table) {
    content = <p className="text-stone-500">กำลังโหลด...</p>;
  } else if (event.status !== "open") {
    content = <p className="text-red-600">งานนี้ปิดรับจองแล้ว</p>;
  } else if (bookingType === "full_table" && table.seatsReserved !== 0) {
    content = <p className="text-red-600">โต๊ะนี้มีคนจองบางส่วนแล้ว ไม่สามารถเหมาได้</p>;
  } else if (bookingType === "seats" && table.isFullTableBooking) {
    content = <p className="text-red-600">โต๊ะนี้ถูกเหมาไปแล้ว</p>;
  } else {
    const seatsRemaining = table.seatsAvailable;
    content = (
      <div className="space-y-4">
        <div>
          <a href={`/events/${id}`} className="text-sm text-maroon-700 hover:text-maroon-800 hover:underline">
            ← กลับไปหน้าจองโต๊ะ
          </a>
          <h1 className="text-2xl font-display font-semibold text-stone-800 mt-1">
            {bookingType === "full_table" ? "เหมาโต๊ะ" : "จองที่นั่ง"} — โต๊ะ {table.tableNumber}
          </h1>
          <p className="text-stone-500 text-sm">{event.name}</p>
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
      </div>
    );
  }

  return (
    <div>
      <SiteNav />
      <main className="max-w-md mx-auto p-4">{content}</main>
    </div>
  );
}
