"use client";

import { useState } from "react";
import Link from "next/link";
import SiteNav from "@/app/components/site-nav";
import {
  validateNamePart,
  validateThaiPhone,
  formatThaiPhoneDisplay,
  cleanPhoneForStorage,
  isValidEmailFormat,
  normalizeEmail,
} from "@/lib/formValidation";

// Standalone version of the alumni self-registration that already exists
// inline as the "ฉันเป็นศิษย์เก่า" checkbox in reserve-form.tsx — same
// fields, same POST target (/api/alumni) — for people who want to join the
// alumni directory without going through a table booking first. Linked
// from the "ลงทะเบียนศิษย์เก่า" card on the homepage.
export default function RegisterPage() {
  // Name kept as two fields in the UI (per PDPA form-UX guidelines) but
  // combined into one "fullName" string before it's sent — the Alumni
  // table's schema is a single fullName column, unchanged here.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [department, setDepartment] = useState("");
  const [currentOccupation, setCurrentOccupation] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [lineId, setLineId] = useState("");
  const [consent, setConsent] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function validate(): boolean {
    const errs: Record<string, string> = {};

    const firstErr = validateNamePart(firstName, "ชื่อ");
    if (firstErr) errs.firstName = firstErr;
    const lastErr = validateNamePart(lastName, "นามสกุล");
    if (lastErr) errs.lastName = lastErr;

    // Phone and email are optional on this form (people can register with
    // just a name), but if provided they must be well-formed.
    if (phone.trim()) {
      const phoneErr = validateThaiPhone(phone);
      if (phoneErr) errs.phone = phoneErr;
    }
    if (email.trim() && !isValidEmailFormat(email)) {
      errs.email = "รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";
    }
    if (!consent) {
      errs.consent = "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนลงทะเบียน";
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/alumni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: `${firstName.trim()} ${lastName.trim()}`.trim(),
          graduationYear: graduationYear || undefined,
          department: department || undefined,
          currentOccupation: currentOccupation || undefined,
          phone: phone.trim() ? cleanPhoneForStorage(phone) : undefined,
          email: email.trim() ? normalizeEmail(email) : undefined,
          lineId: lineId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ลงทะเบียนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        return;
      }
      setDone(true);
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = (field: string) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
      fieldErrors[field]
        ? "border-red-400 focus:ring-red-400"
        : "border-stone-300 focus:ring-primary-500"
    }`;

  return (
    <div>
      <SiteNav />

      <main className="max-w-lg mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <span className="text-xs font-medium tracking-wide uppercase text-maroon-700">ทำเนียบศิษย์เก่า</span>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-stone-800 mt-1">ลงทะเบียนศิษย์เก่า</h1>
          <p className="text-stone-500 text-sm mt-2">
            เพิ่มชื่อของคุณเข้าทำเนียบศิษย์เก่า เพื่อให้วิทยาลัยติดต่อและแจ้งข่าวสารรุ่นได้
          </p>
        </div>

        {done ? (
          <div className="bg-white rounded-2xl border border-cream-200 shadow-md p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h2 className="font-display font-semibold text-stone-800 text-lg">ลงทะเบียนสำเร็จ</h2>
            <p className="text-stone-500 text-sm mt-1.5">ขอบคุณที่ร่วมเป็นส่วนหนึ่งของทำเนียบศิษย์เก่าครับ/ค่ะ</p>
            <Link
              href="/"
              className="inline-block mt-6 text-sm font-medium bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-lg px-5 py-2.5"
            >
              กลับหน้าแรก
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="bg-white rounded-2xl border border-cream-200 shadow-md p-6 sm:p-7 space-y-4">
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  ชื่อ <span className="text-red-600">*</span>
                </label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  maxLength={100}
                  className={inputClass("firstName")}
                />
                {fieldErrors.firstName && <p className="text-xs text-red-600 mt-1">{fieldErrors.firstName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  นามสกุล <span className="text-red-600">*</span>
                </label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  maxLength={100}
                  className={inputClass("lastName")}
                />
                {fieldErrors.lastName && <p className="text-xs text-red-600 mt-1">{fieldErrors.lastName}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">ปีที่จบ</label>
                <input
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value)}
                  placeholder="เช่น 2560"
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">สาขาวิชา</label>
                <input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">อาชีพปัจจุบัน</label>
              <input
                value={currentOccupation}
                onChange={(e) => setCurrentOccupation(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">เบอร์โทร</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatThaiPhoneDisplay(e.target.value))}
                  placeholder="08X-XXX-XXXX"
                  className={inputClass("phone")}
                />
                {fieldErrors.phone && <p className="text-xs text-red-600 mt-1">{fieldErrors.phone}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Line ID</label>
                <input
                  value={lineId}
                  onChange={(e) => setLineId(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">อีเมล</label>
              <input
                type="email"
                autoComplete="email"
                autoCapitalize="off"
                autoCorrect="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={(e) => setEmail(normalizeEmail(e.target.value))}
                className={inputClass("email")}
              />
              {fieldErrors.email && <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>}
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

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {submitting ? "กำลังบันทึก..." : "ลงทะเบียน"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
