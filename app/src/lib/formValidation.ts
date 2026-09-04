// Shared client+server validation helpers for public-facing forms
// (register/page.tsx, reserve-form.tsx) and their API routes
// (api/alumni, lib/bookTable.ts). Kept dependency-free (no DOM APIs) so the
// same functions run in both the browser and Next.js server code.

// Thai script block (฀–๿) covers ก-๙ and all Thai combining marks/
// tone marks, so names typed with vowels/tone marks above or below the
// consonant (เช่น "พิมพ์ใจ") still match — a plain ก-๙ range alone would
// reject some real Thai names.
const NAME_CHAR_RE = /^[A-Za-z฀-๿\s-]+$/;

export function validateNamePart(value: string, label: string): string | null {
  const v = value.trim();
  if (!v) return `กรุณากรอก${label}`;
  if (v.length < 2) return `${label}สั้นเกินไป (อย่างน้อย 2 ตัวอักษร)`;
  if (v.length > 100) return `${label}ยาวเกินไป (ไม่เกิน 100 ตัวอักษร)`;
  if (!NAME_CHAR_RE.test(v)) {
    return `${label}ใช้ได้เฉพาะตัวอักษรไทย/อังกฤษ ช่องว่าง และยัติภังค์ (-) เท่านั้น`;
  }
  return null;
}

// ---- Phone ----

// Strips everything except digits and a leading "+" — what actually gets
// stored/sent to the server. Dashes and spaces are purely a display nicety
// (see formatThaiPhoneDisplay) and must never end up in the saved value.
export function cleanPhoneForStorage(input: string): string {
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  return hasPlus ? `+${digits}` : digits;
}

export function validateThaiPhone(input: string): string | null {
  const cleaned = cleanPhoneForStorage(input);
  if (!cleaned) return "กรุณากรอกเบอร์โทรศัพท์";
  // Domestic: 0XXXXXXXXX (10 digits total)
  if (/^0\d{9}$/.test(cleaned)) return null;
  // International with country code: +66XXXXXXXXX (9 digits after +66)
  if (/^\+66\d{9}$/.test(cleaned)) return null;
  return "กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก (ขึ้นต้นด้วย 0) หรือใส่รหัสประเทศ +66";
}

// Live "0XX-XXX-XXXX" mask while typing. Only re-formats the digits the
// user has typed so far — never pads or guesses missing digits.
export function formatThaiPhoneDisplay(input: string): string {
  if (input.trim().startsWith("+")) {
    // Leave international-format numbers unmasked; the +66 prefix doesn't
    // fit the domestic 3-3-4 grouping.
    return `+${input.replace(/[^\d]/g, "")}`;
  }
  const digits = input.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

// ---- Email ----

const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailFormat(email: string): boolean {
  return EMAIL_FORMAT_RE.test(email.trim());
}

// Trim + lowercase before it ever reaches the database — so
// "Somchai@Gmail.com " and "somchai@gmail.com" are always stored/compared
// as the same address.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
