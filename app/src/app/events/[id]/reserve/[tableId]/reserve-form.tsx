"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  validateNamePart,
  validateThaiPhone,
  formatThaiPhoneDisplay,
  cleanPhoneForStorage,
  isValidEmailFormat,
  normalizeEmail,
} from "@/lib/formValidation";

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
  // Name kept as two fields in the UI (per PDPA form-UX guidelines) but
  // combined into one "bookerName" string before it's sent — the
  // Reservation table's schema is a single bookerName column, unchanged.
  const [bookerFirstName, setBookerFirstName] = useState("");
  const [bookerLastName, setBookerLastName] = useState("");
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

  const [consent, setConsent] = useState(false);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [bookingCode, setBookingCode] = useState("");

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

  function validate(): boolean {
    const errs: Record<string, string> = {};

    const firstErr = validateNamePart(bookerFirstName, "ชื่อ");
    if (firstErr) errs.bookerFirstName = firstErr;
    const lastErr = validateNamePart(bookerLastName, "นามสกุล");
    if (lastErr) errs.bookerLastName = lastErr;

    const phoneErr = validateThaiPhone(bookerPhone);
    if (phoneErr) errs.bookerPhone = phoneErr;

    if (!bookerEmail.trim()) {
      errs.bookerEmail = "กรุณากรอกอีเมล";
    } else if (!isValidEmailFormat(bookerEmail)) {
      errs.bookerEmail = "รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";
    }

    if (!slipFile) {
      errs.slipFile = "กรุณาแนบไฟล์สลิปโอนเงิน";
    }
    if (!consent) {
      errs.consent = "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนยืนยันการจอง";
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setSubmitting(true);
    const partyNames = companions.map((c) => c.trim()).filter(Boolean);
    const bookerName = `${bookerFirstName.trim()} ${bookerLastName.trim()}`.trim();
    const cleanedPhone = cleanPhoneForStorage(bookerPhone);
    const cleanedEmail = normalizeEmail(bookerEmail);

    const formData = new FormData();
    formData.append("eventId", eventId);
    formData.append("tableId", tableId);
    formData.append("bookingType", bookingType);
    formData.append("seatCount", String(seatCount));
    formData.append("bookerName", bookerName);
    formData.append("bookerPhone", cleanedPhone);
    formData.append("bookerEmail", cleanedEmail);
    if (partyNames.length > 0) formData.append("partyNames", JSON.stringify(partyNames));
    formData.append("file", slipFile as File);

    const res = await fetch("/api/reservations", {
      method: "POST",
      body: formData,
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
            phone: cleanedPhone,
            email: cleanedEmail || undefined,
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
    setBookingCode(data.bookingCode);
    setDone(true);
  }

  const inputClass = (field: string) =>
    `w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-shadow ${
      fieldErrors[field]
        ? "border-red-400 focus:ring-red-300 focus:border-red-500"
        : "border-stone-300 focus:ring-primary-400 focus:border-primary-500"
    }`;

  if (done) {
    return (
      <div className="max-w-md bg-white border border-cream-200 shadow-md rounded-xl p-6 text-center space-y-3">
        <h2 className="text-xl font-display font-semibold text-emerald-600">จองโต๊ะและส่งสลิปสำเร็จ</h2>
        <p className="text-stone-600">รหัสการจองของท่านคือ {bookingCode}</p>
        <p className="text-sm text-stone-500">
          เจ้าหน้าที่จะตรวจสอบสลิปการโอนเงินโดยเร็วที่สุด ท่านสามารถตรวจสอบสถานะได้ที่หน้าตรวจสอบการจอง
        </p>
        <button
          onClick={() => router.push(`/status?bookingCode=${bookingCode}&phone=${encodeURIComponent(bookerPhone)}`)}
          className="bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-lg px-4 py-2 font-medium"
        >
          เช็คสถานะการจอง
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 bg-white border border-cream-200 shadow-md rounded-xl p-5 max-w-md">
      {bookingType === "seats" && (
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">จำนวนที่นั่ง (เหลือ {seatsRemaining} ที่)</label>
          <input
            type="number"
            min={1}
            max={seatsRemaining}
            value={seatCount}
            onChange={(e) => setSeatCount(Number(e.target.value))}
            className={inputClass("seatCount")}
            required
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            ชื่อผู้จอง <span className="text-red-600">*</span>
          </label>
          <input
            value={bookerFirstName}
            onChange={(e) => setBookerFirstName(e.target.value)}
            autoComplete="given-name"
            maxLength={100}
            className={inputClass("bookerFirstName")}
          />
          {fieldErrors.bookerFirstName && <p className="text-xs text-red-600 mt-1">{fieldErrors.bookerFirstName}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            นามสกุลผู้จอง <span className="text-red-600">*</span>
          </label>
          <input
            value={bookerLastName}
            onChange={(e) => setBookerLastName(e.target.value)}
            autoComplete="family-name"
            maxLength={100}
            className={inputClass("bookerLastName")}
          />
          {fieldErrors.bookerLastName && <p className="text-xs text-red-600 mt-1">{fieldErrors.bookerLastName}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          เบอร์โทรศัพท์ <span className="text-red-600">*</span>
        </label>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={bookerPhone}
          onChange={(e) => setBookerPhone(formatThaiPhoneDisplay(e.target.value))}
          placeholder="08X-XXX-XXXX"
          className={inputClass("bookerPhone")}
        />
        {fieldErrors.bookerPhone && <p className="text-xs text-red-600 mt-1">{fieldErrors.bookerPhone}</p>}
        <p className="text-xs text-stone-400 mt-1">ใช้เบอร์นี้เช็คสถานะการจองในภายหลัง</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          อีเมล <span className="text-red-600">*</span>
        </label>
        <input
          type="email"
          autoComplete="email"
          autoCapitalize="off"
          autoCorrect="off"
          value={bookerEmail}
          onChange={(e) => setBookerEmail(e.target.value)}
          onBlur={(e) => setBookerEmail(normalizeEmail(e.target.value))}
          className={inputClass("bookerEmail")}
        />
        {fieldErrors.bookerEmail && <p className="text-xs text-red-600 mt-1">{fieldErrors.bookerEmail}</p>}
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

      <div className="border-t border-cream-200 pt-3">
        <label className="block text-sm font-medium text-stone-700 mb-1">
          ไฟล์สลิปโอนเงิน <span className="text-red-600">*</span>
        </label>
        <p className="text-xs text-stone-400 mb-1">กรุณาโอนเงินตามยอดด้านบนแล้วแนบรูปสลิปที่นี่ ระบบจะบันทึกการจองและส่งสลิปให้เจ้าหน้าที่ตรวจสอบในขั้นตอนเดียวกัน</p>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setSlipFile(e.target.files?.[0] || null)}
          className={inputClass("slipFile")}
        />
        {fieldErrors.slipFile && <p className="text-xs text-red-600 mt-1">{fieldErrors.slipFile}</p>}
      </div>

      <div className="border-t border-cream-200 pt-3">
        <label className="flex items-start gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="accent-maroon-700 mt-0.5"
          />
          <span>
            ข้าพเจ้ายินยอมให้เก็บและใช้ข้อมูลตาม{" "}
            <Link href="/privacy" target="_blank" className="text-maroon-700 underline hover:text-maroon-800">
              นโยบายความเป็นส่วนตัว
            </Link>{" "}
            <span className="text-red-600">*</span>
          </span>
        </label>
        {fieldErrors.consent && <p className="text-xs text-red-600 mt-1">{fieldErrors.consent}</p>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-maroon-700 hover:bg-maroon-800 text-white font-medium py-2.5 transition-colors disabled:opacity-50"
      >
        {submitting ? "กำลังส่งข้อมูล..." : "ยืนยันการจองและส่งสลิป"}
      </button>
    </form>
  );
}
