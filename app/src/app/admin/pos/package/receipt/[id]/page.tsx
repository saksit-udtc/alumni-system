"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QrCode from "@/app/components/qr-code";

interface PackageSaleItem {
  id: string;
  productName: string;
  size: string | null;
  quantity: number;
}
interface PackageReservation {
  id: string;
  bookingCode: string;
  qrCodeToken: string | null;
  bookingType: "full_table" | "seats";
  seatCount: number;
  bookerName: string;
  bookerPhone: string;
  totalAmount: string;
  paymentMethod: "cash" | "transfer" | null;
  createdAt: string;
  event: { name: string; eventDate: string; location: string | null };
  table: { tableNumber: number; zone: string | null };
  package: { name: string } | null;
  packageItems: PackageSaleItem[];
  cashierUser: { username: string } | null;
}

const PAYMENT_LABEL: Record<string, string> = { cash: "เงินสด", transfer: "โอนเงิน" };

// Confirmation/ticket view for a POS package sale — same narrow-receipt,
// browser-print pattern as ../../receipt/[id]/page.tsx, but shows a
// check-in QR code (same token/URL scheme as the online booking flow's
// ticket) instead of a Code128 barcode, since this doubles as the
// attendee's event-day ticket, not just a sale record.
export default function PackageSaleReceiptPage({ params }: { params: { id: string } }) {
  const [reservation, setReservation] = useState<PackageReservation | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/packages/sales/${params.id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "ไม่พบข้อมูลการขาย");
        setReservation(data.reservation);
      })
      .catch((e) => setError(e.message || "เกิดข้อผิดพลาด"));
  }, [params.id]);

  if (error) return <div className="text-red-600 text-sm p-4">{error}</div>;
  if (!reservation) return <div className="text-sm text-stone-400 p-4">กำลังโหลด...</div>;

  const createdAt = new Date(reservation.createdAt);
  const checkinUrl = reservation.qrCodeToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/admin/checkin/${reservation.qrCodeToken}`
    : "";

  return (
    <div>
      <div className="max-w-xs mx-auto flex gap-2 mb-4 print:hidden">
        <button onClick={() => window.print()} className="flex-1 bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg py-2 font-semibold text-sm">
          พิมพ์ใบยืนยัน
        </button>
        <Link href="/admin/pos/package" className="flex-1 text-center bg-white border border-stone-300 rounded-lg py-2 text-sm text-stone-700 hover:bg-cream-50">
          ขายรายการถัดไป
        </Link>
      </div>

      <div className="max-w-xs mx-auto bg-white border border-cream-200 shadow-md print:shadow-none print:border-0 rounded-lg p-4 font-mono text-sm text-stone-800">
        <div className="text-center mb-2">
          <div className="font-display font-bold text-base">ใบยืนยันการจอง (แพ็กเกจ)</div>
          <div className="text-xs text-stone-500">ขายหน้างาน (POS) — งานคืนสู่เหย้า</div>
        </div>
        <div className="border-t border-dashed border-stone-300 my-2" />
        <div className="text-xs space-y-0.5">
          <div>รหัสจอง: {reservation.bookingCode}</div>
          <div>วันที่ขาย: {createdAt.toLocaleString("th-TH")}</div>
          <div>งาน: {reservation.event.name}</div>
          <div>วันงาน: {new Date(reservation.event.eventDate).toLocaleDateString("th-TH")}</div>
          <div>
            โต๊ะ: {reservation.table.tableNumber}
            {reservation.table.zone ? ` (${reservation.table.zone})` : ""} —{" "}
            {reservation.bookingType === "full_table" ? "จองทั้งโต๊ะ" : `${reservation.seatCount} ที่นั่ง`}
          </div>
          {reservation.package && <div>แพ็กเกจ: {reservation.package.name}</div>}
          <div>ผู้จอง: {reservation.bookerName}</div>
          <div>เบอร์โทร: {reservation.bookerPhone}</div>
          {reservation.cashierUser && <div>ผู้ขาย: {reservation.cashierUser.username}</div>}
        </div>
        <div className="border-t border-dashed border-stone-300 my-2" />
        <div className="text-xs font-medium mb-1">ของแถมในแพ็กเกจ</div>
        <div className="space-y-0.5">
          {reservation.packageItems.map((it) => (
            <div key={it.id} className="flex justify-between gap-2">
              <span>
                {it.productName}
                {it.size ? ` (${it.size})` : ""}
              </span>
              <span>x{it.quantity}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-dashed border-stone-300 my-2" />
        <div className="flex justify-between font-bold text-base">
          <span>ยอดชำระ</span>
          <span>{Number(reservation.totalAmount).toLocaleString()} บาท</span>
        </div>
        {reservation.paymentMethod && (
          <div className="text-xs mt-1">ชำระโดย: {PAYMENT_LABEL[reservation.paymentMethod] || reservation.paymentMethod}</div>
        )}
        <div className="border-t border-dashed border-stone-300 my-2" />
        {checkinUrl && (
          <div className="flex flex-col items-center py-1">
            <QrCode value={checkinUrl} size={140} />
            <div className="text-[10px] text-stone-400 mt-1">แสดง QR นี้ตอนเช็คอินหน้างาน</div>
          </div>
        )}
        <div className="text-center text-xs text-stone-400 mt-1">ขอบคุณที่ร่วมงานคืนสู่เหย้า</div>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:shadow-none,
          .print\\:shadow-none * {
            visibility: visible;
          }
          .print\\:shadow-none {
            position: absolute;
            left: 0;
            top: 0;
          }
        }
      `}</style>
    </div>
  );
}
