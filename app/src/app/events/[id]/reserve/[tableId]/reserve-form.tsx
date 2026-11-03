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
import { PENDING_HOLD_MINUTES } from "@/lib/holdPolicy";

// ลำดับช่องบนฟอร์ม — ใช้เลื่อนหน้าจอไปช่องแรกที่ผิดตอนกดส่ง
const FIELD_ORDER = ["bookerFirstName", "bookerLastName", "bookerPhone", "bookerEmail", "consent"];

export default function ReserveForm({
  eventId,
  tableId,
  bookingType,
  capacity,
  seatsRemaining,
  pricePerTable,
  pricePerSeat,
  packageId,
  packagePrice,
  packageItemSizeSelections,
  eventName,
  tableNumber,
  packageName,
}: {
  eventId: string;
  tableId: string;
  bookingType: "full_table" | "seats";
  capacity: number;
  seatsRemaining: number;
  pricePerTable: number;
  pricePerSeat: number;
  /** When set (Phase 2 package purchase — see ../page.tsx's package
   * selector), this booking is submitted to /api/reservations/package
   * instead of /api/reservations, and packagePrice replaces the normal
   * pricePerTable/pricePerSeat total. Everything else about the form
   * (validation, alumni registration, slip upload, the "done" screen)
   * stays exactly the same regardless of which mode this is. */
  packageId?: string;
  packagePrice?: number;
  /** Guest's chosen size per PackageItem that has buyerChoosesSize:true
   * (keyed by packageItemId) — collected by the PackagePicker in
   * ../page.tsx, sent through unchanged as JSON. */
  packageItemSizeSelections?: Record<string, string>;
  /** Display-only, for the "รายการ" line under the PromptPay QR so a
   * scanning customer (or whoever reviews the payment later) can tell what
   * the amount is for at a glance — never sent to the server. */
  eventName?: string;
  tableNumber?: string | number;
  packageName?: string;
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
  // Inline validation: ช่องไหนที่ผู้ใช้แตะแล้ว (blur / เลือกไฟล์ / ติ๊ก) จึงเริ่มแสดง error ของช่องนั้น
  // ไม่แสดงตอนยังไม่เคยแตะ เพื่อไม่ให้ฟอร์มเป็นสีแดงตั้งแต่เปิดหน้า — หลังแตะแล้วตรวจสดทุกครั้งที่พิมพ์
  // ข้อความแดงจึงหายทันทีที่กรอกถูก และเมื่อกดส่ง (submitted) จะแสดง error ของทุกช่อง
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  function touch(field: string) {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

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

  const total = packageId ? packagePrice ?? 0 : bookingType === "full_table" ? pricePerTable : pricePerSeat * seatCount;

  function computeErrors(): Record<string, string> {
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

    if (!consent) {
      errs.consent = "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนยืนยันการจอง";
    }

    return errs;
  }

  // error ที่ "แสดงจริง": เฉพาะช่องที่แตะแล้ว หรือทุกช่องหลังกดส่ง
  const allErrors = computeErrors();
  const fieldErrors: Record<string, string> = {};
  for (const key of Object.keys(allErrors)) {
    if (submitted || touched[key]) fieldErrors[key] = allErrors[key];
  }

  function validate(): boolean {
    const errs = computeErrors();
    const first = FIELD_ORDER.find((k) => errs[k]);
    if (first) {
      // พาผู้ใช้ไปยังช่องแรกที่ยังไม่ผ่าน
      const el = document.getElementById(`reserve-${first}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
    }
    return !first;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitted(true);
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
    if (packageId) formData.append("packageId", packageId);
    if (packageId && packageItemSizeSelections && Object.keys(packageItemSizeSelections).length > 0) {
      formData.append("itemSizeSelections", JSON.stringify(packageItemSizeSelections));
    }

    const res = await fetch(packageId ? "/api/reservations/package" : "/api/reservations", {
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

    // ร่างการจองถูกสร้างและกันโต๊ะไว้แล้ว (pending) — ไปหน้าชำระเงิน: สแกน QR + แนบสลิป ภายในเวลาที่กันไว้
    // ไม่ setSubmitting(false) เพราะกำลังเปลี่ยนหน้า (กันกดซ้ำระหว่างรอ)
    router.push(`/reservations/${data.bookingCode}/upload-slip?phone=${encodeURIComponent(cleanedPhone)}`);
  }

  const inputClass = (field: string) =>
    `w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-shadow ${
      fieldErrors[field]
        ? "border-red-400 focus:ring-red-300 focus:border-red-500"
        : "border-stone-300 focus:ring-primary-400 focus:border-primary-500"
    }`;

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
            id="reserve-bookerFirstName"
            value={bookerFirstName}
            onChange={(e) => setBookerFirstName(e.target.value)}
            onBlur={() => touch("bookerFirstName")}
            aria-invalid={!!fieldErrors.bookerFirstName}
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
            id="reserve-bookerLastName"
            value={bookerLastName}
            onChange={(e) => setBookerLastName(e.target.value)}
            onBlur={() => touch("bookerLastName")}
            aria-invalid={!!fieldErrors.bookerLastName}
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
          id="reserve-bookerPhone"
          type="tel"
          inputMode="numeric"
          onBlur={() => touch("bookerPhone")}
          aria-invalid={!!fieldErrors.bookerPhone}
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
          id="reserve-bookerEmail"
          type="email"
          aria-invalid={!!fieldErrors.bookerEmail}
          autoComplete="email"
          autoCapitalize="off"
          autoCorrect="off"
          value={bookerEmail}
          onChange={(e) => setBookerEmail(e.target.value)}
          onBlur={(e) => {
            setBookerEmail(normalizeEmail(e.target.value));
            touch("bookerEmail");
          }}
          className={inputClass("bookerEmail")}
        />
        {fieldErrors.bookerEmail && <p className="text-xs text-red-600 mt-1">{fieldErrors.bookerEmail}</p>}
        <p className="text-xs text-stone-400 mt-1">ใช้ส่ง QR Code ยืนยันการจองให้ทางอีเมลนี้หลังตรวจสอบสลิปแล้ว (หากไม่พบอีเมลในกล่องจดหมายเข้า กรุณาตรวจสอบในโฟลเดอร์อีเมลขยะ (Junk/Spam))</p>
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
      <p className="text-xs text-stone-500 bg-cream-50 border border-cream-200 rounded-lg px-3 py-2">
        เมื่อกดปุ่มด้านล่าง ระบบจะ<strong>กัน{bookingType === "full_table" ? "โต๊ะ" : "ที่นั่ง"}ไว้ให้ท่าน {PENDING_HOLD_MINUTES} นาที</strong>
        แล้วพาไปหน้าชำระเงิน (สแกน QR และแนบสลิป) หากไม่ชำระภายในเวลา ระบบจะปล่อย{bookingType === "full_table" ? "โต๊ะ" : "ที่นั่ง"}ให้ผู้อื่นโดยอัตโนมัติ
      </p>

      <div className="border-t border-cream-200 pt-3">
        <label className="flex items-start gap-2 text-sm text-stone-700">
          <input
            id="reserve-consent"
            type="checkbox"
            checked={consent}
            aria-invalid={!!fieldErrors.consent}
            onChange={(e) => {
              setConsent(e.target.checked);
              touch("consent");
            }}
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
        {submitting ? "กำลังบันทึกการจอง..." : "ยืนยันการจองและไปหน้าชำระเงิน"}
      </button>
    </form>
  );
}
