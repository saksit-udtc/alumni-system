"use client";
import { useState, useEffect, useMemo, useRef } from "react";
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
import PayQr from "@/app/components/pay-qr";
import { generatePromptPayPayload } from "@/lib/promptpay";

// ขนาดไฟล์สลิปสูงสุดฝั่งหน้าเว็บ (ตรงกับเพดาน 10MB ของ upload อื่นๆ ในระบบ)
const SLIP_MAX_BYTES = 10 * 1024 * 1024;

// ลำดับช่องบนฟอร์ม — ใช้เลื่อนหน้าจอไปช่องแรกที่ผิดตอนกดส่ง
const FIELD_ORDER = ["bookerFirstName", "bookerLastName", "bookerPhone", "bookerEmail", "slipFile", "consent"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const [slipFile, setSlipFile] = useState<File | null>(null);
  // Inline validation: ช่องไหนที่ผู้ใช้แตะแล้ว (blur / เลือกไฟล์ / ติ๊ก) จึงเริ่มแสดง error ของช่องนั้น
  // ไม่แสดงตอนยังไม่เคยแตะ เพื่อไม่ให้ฟอร์มเป็นสีแดงตั้งแต่เปิดหน้า — หลังแตะแล้วตรวจสดทุกครั้งที่พิมพ์
  // ข้อความแดงจึงหายทันทีที่กรอกถูก และเมื่อกดส่ง (submitted) จะแสดง error ของทุกช่อง
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const slipInputRef = useRef<HTMLInputElement>(null);
  const [slipPreviewUrl, setSlipPreviewUrl] = useState<string | null>(null);
  const [slipPreviewFailed, setSlipPreviewFailed] = useState(false);

  function touch(field: string) {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  // Preview รูปสลิป: สร้าง object URL ในเครื่อง (ไม่อัปโหลดอะไรขึ้นเซิร์ฟเวอร์) และคืนหน่วยความจำทุกครั้งที่เปลี่ยนไฟล์/ออกจากหน้า
  useEffect(() => {
    setSlipPreviewFailed(false);
    if (!slipFile || !slipFile.type.startsWith("image/")) {
      setSlipPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(slipFile);
    setSlipPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [slipFile]);

  function clearSlip() {
    setSlipFile(null);
    touch("slipFile");
    if (slipInputRef.current) slipInputRef.current.value = "";
  }
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [bookingCode, setBookingCode] = useState("");
  // PromptPay QR is purely a convenience for the customer (scan instead of
  // manually opening their banking app and typing an account number) — the
  // slip-upload + admin-verify flow below is unchanged either way. Same
  // setting the POS payment screen uses (lib/settings.ts), fetched from a
  // public endpoint since this is an unauthenticated page.
  const [promptPayId, setPromptPayId] = useState("");

  useEffect(() => {
    fetch("/api/settings/promptpay")
      .then((r) => r.json())
      .then((d) => setPromptPayId(d.promptPayId || ""))
      .catch(() => {});
  }, []);

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

  // A fresh dynamic PromptPay QR pre-filled with the exact total, same
  // generator the POS payment screen uses — this only displays a payment
  // target, it doesn't confirm anything, so the customer still uploads a
  // slip below exactly as before.
  const promptPayPayload = useMemo(() => {
    if (!promptPayId || total <= 0) return null;
    try {
      return generatePromptPayPayload(promptPayId, total);
    } catch {
      return null;
    }
  }, [promptPayId, total]);

  // "รายการ" line shown under the QR — purely descriptive (never sent
  // anywhere), so a customer or anyone reviewing the payment later can see
  // what the amount is for without having to scroll back up the page.
  const paymentLabel = packageId
    ? `แพ็กเกจ "${packageName || ""}"${tableNumber != null ? ` — โต๊ะ ${tableNumber}` : ""}`
    : `จองโต๊ะ${tableNumber != null ? ` ${tableNumber}` : ""}${eventName ? ` — ${eventName}` : ""}`;

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

    if (!slipFile) {
      errs.slipFile = "กรุณาแนบไฟล์สลิปโอนเงิน";
    } else if (slipFile.type && !slipFile.type.startsWith("image/") && slipFile.type !== "application/pdf") {
      // type ว่างได้ (บางเครื่องไม่ระบุชนิดไฟล์ เช่น HEIC บน Windows) จึงไม่ปฏิเสธกรณีนั้น
      errs.slipFile = "รองรับเฉพาะไฟล์รูปภาพหรือ PDF เท่านั้น";
    } else if (slipFile.size === 0) {
      errs.slipFile = "ไฟล์ว่างเปล่า กรุณาเลือกไฟล์สลิปใหม่";
    } else if (slipFile.size > SLIP_MAX_BYTES) {
      errs.slipFile = `ไฟล์ใหญ่เกินไป (${formatFileSize(slipFile.size)}) ขนาดต้องไม่เกิน 10 MB`;
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
    formData.append("file", slipFile as File);
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

      {promptPayPayload && (
        <PayQr value={promptPayPayload} amount={total} label={paymentLabel} title={eventName} size={180} />
      )}

      <div className="border-t border-cream-200 pt-3">
        <label className="block text-sm font-medium text-stone-700 mb-1">
          ไฟล์สลิปโอนเงิน <span className="text-red-600">*</span>
        </label>
        <p className="text-xs text-stone-400 mb-1">กรุณาโอนเงินตามยอดด้านบนแล้วแนบรูปสลิปที่นี่ ระบบจะบันทึกการจองและส่งสลิปให้เจ้าหน้าที่ตรวจสอบในขั้นตอนเดียวกัน</p>
        <input
          id="reserve-slipFile"
          ref={slipInputRef}
          type="file"
          accept="image/*,application/pdf"
          aria-invalid={!!fieldErrors.slipFile}
          onChange={(e) => {
            setSlipFile(e.target.files?.[0] || null);
            touch("slipFile");
          }}
          className={inputClass("slipFile")}
        />
        {fieldErrors.slipFile && <p className="text-xs text-red-600 mt-1">{fieldErrors.slipFile}</p>}

        {slipFile && (
          <div className="mt-2 flex items-start gap-3 rounded-lg border border-cream-200 bg-cream-50 p-2">
            {slipPreviewUrl && !slipPreviewFailed ? (
              <a href={slipPreviewUrl} target="_blank" rel="noopener noreferrer" title="คลิกเพื่อดูรูปขนาดเต็ม" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slipPreviewUrl}
                  alt="ตัวอย่างสลิปที่เลือก"
                  onError={() => setSlipPreviewFailed(true)}
                  className="h-40 w-auto max-w-[9rem] rounded border border-stone-200 bg-white object-contain"
                />
              </a>
            ) : (
              <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded border border-stone-200 bg-white text-xs font-semibold text-stone-500">
                {slipFile.type === "application/pdf" ? "PDF" : "ไฟล์"}
              </div>
            )}
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-medium text-stone-700" title={slipFile.name}>{slipFile.name}</p>
              <p className="text-xs text-stone-500">{formatFileSize(slipFile.size)}</p>
              {slipPreviewFailed && (
                <p className="mt-1 text-xs text-stone-400">ไม่สามารถแสดงตัวอย่างไฟล์ชนิดนี้ได้ แต่ยังส่งได้ตามปกติ</p>
              )}
              {!allErrors.slipFile && <p className="mt-1 text-xs text-emerald-600">พร้อมส่ง — ตรวจให้แน่ใจว่าเห็นยอดเงินและวันที่ชัดเจน</p>}
              <button
                type="button"
                onClick={clearSlip}
                className="mt-1 text-xs text-red-600 underline hover:text-red-700"
              >
                ลบไฟล์
              </button>
            </div>
          </div>
        )}
      </div>

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
        {submitting ? "กำลังส่งข้อมูล..." : "ยืนยันการจองและส่งสลิป"}
      </button>
    </form>
  );
}
