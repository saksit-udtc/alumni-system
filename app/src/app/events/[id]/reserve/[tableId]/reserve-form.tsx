"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ReserveForm({
  eventId,
  tableId,
  bookingType,
  capacity,
  seatsRemaining,
  pricePerTable,
  pricePerSeat,
}: {
  eventId: string;
  tableId: string;
  bookingType: "full_table" | "seats";
  capacity: number;
  seatsRemaining: number;
  pricePerTable: number;
  pricePerSeat: number;
}) {
  const router = useRouter();
  const [seatCount, setSeatCount] = useState(bookingType === "full_table" ? capacity : 1);
  const [bookerName, setBookerName] = useState("");
  const [bookerPhone, setBookerPhone] = useState("");
  const [bookerEmail, setBookerEmail] = useState("");
  // Companion names — one fewer than seatCount, since the booker themself
  // already fills one seat. Optional: staff don't need every guest's name
  // to process the booking, but it helps front-of-house on event day.
  const [companions, setCompanions] = useState<string[]>([]);

  // Optional alumni self-registration alongside the booking. Not everyone
  // booking a table is an alumnus themselves (could be booking for a
  // group, a spouse, a guest of the college), so this is opt-in via the
  // checkbox rather than assumed from the fact that they're booking.
  const [registerAsAlumni, setRegisterAsAlumni] = useState(false);
  const [graduationYear, setGraduationYear] = useState("");
  const [department, setDepartment] = useState("");
  const [currentOccupation, setCurrentOccupation] = useState("");
  const [lineId, setLineId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Max number of companion names = seats booked minus the booker's own
  // seat. Guests add one name at a time with a button, capped at this
  // number, so the form doesn't show a wall of blank boxes for a big table.
  const maxCompanions = Math.max(0, seatCount - 1);

  // If seatCount shrinks (or the booking type/table changes it), trim any
  // names that no longer fit rather than silently keeping hidden ones.
  useEffect(() => {
    setCompanions((prev) => (prev.length > maxCompanions ? prev.slice(0, maxCompanions) : prev));
  }, [maxCompanions]);

  function addCompanion() {
    setCompanions((prev) => (prev.length < maxCompanions ? [...prev, ""] : prev));
  }

  function removeCompanion(index: number) {
    setCompanions((prev) => prev.filter((_, i) => i !== index));
  }

  const total = bookingType === "full_table" ? pricePerTable : pricePerSeat * seatCount;

  // Same pragmatic format check as the server (lib/bookTable.ts) — catches
  // typos/garbage before a round-trip to the API. Not a deliverability
  // check (no such thing without a paid verification service); the server
  // is still the source of truth since this is only a UX nicety.
  const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (bookerEmail.trim() && !EMAIL_FORMAT_RE.test(bookerEmail.trim())) {
      setError("รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง");
      return;
    }
    setSubmitting(true);
    const partyNames = companions.map((c) => c.trim()).filter(Boolean);
    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        tableId,
        bookingType,
        seatCount,
        bookerName,
        bookerPhone,
        bookerEmail: bookerEmail || undefined,
        partyNames: partyNames.length > 0 ? partyNames : undefined,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setSubmitting(false);
      setError(data.error || "เกิดข้อผิดพลาด กรุณาลองใหม่");
      return;
    }

    // Best-effort alumni registration — the booking already succeeded at
    // this point, so a failure here (e.g. duplicate, network hiccup, or
    // the endpoint not existing yet) should never block the booker from
    // moving on to payment.
    if (registerAsAlumni) {
      try {
        await fetch("/api/alumni", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: bookerName,
            phone: bookerPhone,
            email: bookerEmail || undefined,
            graduationYear: graduationYear || undefined,
            department: department || undefined,
            currentOccupation: currentOccupation || undefined,
            lineId: lineId || undefined,
          }),
        });
      } catch {
        // ignore — alumni registration is a nice-to-have here, not required
      }
    }

    setSubmitting(false);
    // This scaffold's booking API returns a bookingCode (the public
    // booking-status identifier), not the reservation's internal id.
    router.push(`/reservations/${data.bookingCode}/upload-slip?phone=${encodeURIComponent(bookerPhone)}`);
  }

  const inputClass =
    "w-full border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-cream-200 shadow-md rounded-xl p-5 max-w-md">
      {bookingType === "seats" && (
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">จำนวนที่นั่ง (เหลือ {seatsRemaining} ที่)</label>
          <input
            type="number"
            min={1}
            max={seatsRemaining}
            value={seatCount}
            onChange={(e) => setSeatCount(Number(e.target.value))}
            className={inputClass}
            required
          />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">ชื่อ-นามสกุลผู้จอง</label>
        <input
          value={bookerName}
          onChange={(e) => setBookerName(e.target.value)}
          className={inputClass}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">เบอร์โทรศัพท์</label>
        <input
          value={bookerPhone}
          onChange={(e) => setBookerPhone(e.target.value)}
          className={inputClass}
          required
        />
        <p className="text-xs text-stone-400 mt-1">ใช้เบอร์นี้เช็คสถานะการจองในภายหลัง</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">อีเมล</label>
        <input
          type="email"
          value={bookerEmail}
          onChange={(e) => setBookerEmail(e.target.value)}
          className={inputClass}
        />
        <p className="text-xs text-stone-400 mt-1">ใช้ส่ง QR Code ยืนยันการจองให้ทางอีเมลนี้หลังตรวจสอบสลิปแล้ว</p>
      </div>

      {maxCompanions > 0 && (
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            รายชื่อผู้ร่วมโต๊ะ (ไม่บังคับ) — {companions.length}/{maxCompanions} คน
          </label>
          <div className="space-y-2">
            {companions.map((name, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={name}
                  onChange={(e) =>
                    setCompanions((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                  }
                  placeholder={`ผู้ร่วมโต๊ะคนที่ ${i + 1}`}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow"
                />
                <button
                  type="button"
                  onClick={() => removeCompanion(i)}
                  className="shrink-0 text-stone-400 hover:text-red-600 px-2"
                  aria-label="ลบรายชื่อนี้"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {companions.length < maxCompanions && (
            <button
              type="button"
              onClick={addCompanion}
              className="mt-2 text-sm text-primary-700 border border-primary-200 rounded-lg px-3 py-1.5 hover:bg-primary-50 transition-colors"
            >
              + เพิ่มรายชื่อผู้ร่วมโต๊ะ
            </button>
          )}
        </div>
      )}

      <div className="border-t border-cream-200 pt-3">
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={registerAsAlumni}
            onChange={(e) => setRegisterAsAlumni(e.target.checked)}
            className="accent-maroon-700"
          />
          ฉันเป็นศิษย์เก่า ต้องการแจ้งสาขา/ปีที่จบไว้ในระบบด้วย (ไม่บังคับ)
        </label>

        {registerAsAlumni && (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">ปีที่จบ (พ.ศ.)</label>
                <input
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">สาขาที่จบ</label>
                <input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">อาชีพปัจจุบัน</label>
              <input
                value={currentOccupation}
                onChange={(e) => setCurrentOccupation(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Line ID</label>
              <input
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow"
              />
            </div>
          </div>
        )}
      </div>

      <div className="text-sm font-medium text-stone-800">ยอดชำระ: {total.toLocaleString()} บาท</div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-maroon-700 hover:bg-maroon-800 text-white font-medium py-2.5 transition-colors disabled:opacity-50"
      >
        {submitting ? "กำลังจอง..." : "ยืนยันการจอง"}
      </button>
    </form>
  );
}
