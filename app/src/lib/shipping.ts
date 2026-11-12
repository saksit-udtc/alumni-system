/**
 * Shipment helpers shared by the admin API, the public status API and the
 * shipped-notification email.
 */

export type Carrier = "EMS" | "FLASH";

export const CARRIER_LABEL: Record<Carrier, string> = {
  EMS: "ไปรษณีย์ไทย EMS",
  FLASH: "Flash Express",
};

export function isKnownCarrier(c: unknown): c is Carrier {
  return c === "EMS" || c === "FLASH";
}

// Thailand Post EMS numbers: 2 letters + 9 digits + "TH" (13 chars), e.g. EE123456789TH.
const EMS_PATTERN = /^[A-Z]{2}\d{9}TH$/;
// Flash Express (TH) numbers: "TH" + letters/digits (about 13-16 chars), e.g. TH20039C3GDR4D (14 chars).
// Kept lenient on length: a wrong-length number is rejected, but we do not try to validate the check characters.
const FLASH_PATTERN = /^TH[A-Z0-9]{8,16}$/;

/** Uppercases and strips spaces/dashes, so "ee 123-456-789 th" -> "EE123456789TH". */
export function normalizeTrackingNumber(raw: string): string {
  return raw.replace(/[\s-]+/g, "").toUpperCase();
}

export function isValidEmsNumber(normalized: string): boolean {
  return EMS_PATTERN.test(normalized);
}

export function isValidFlashNumber(normalized: string): boolean {
  return FLASH_PATTERN.test(normalized);
}

/**
 * ดึงเลขพัสดุออกจากข้อความที่คัดลอกมา (เช่น "No.: TH20039C3GDR4D" จากแอป Flash)
 * คืน null ถ้าไม่พบเลขในรูปแบบของขนส่งนั้น
 */
export function extractTrackingNumber(raw: string, carrier: Carrier): string | null {
  const text = raw.toUpperCase();
  const m = carrier === "FLASH" ? text.match(/TH[A-Z0-9]{8,16}/) : text.match(/[A-Z]{2}\d{9}TH/);
  return m ? m[0] : null;
}

/** Returns an error message (Thai) when the number does not fit the carrier's format, otherwise null. */
export function validateTrackingNumber(carrier: Carrier, normalized: string): string | null {
  if (!normalized) return "กรุณาระบุเลขพัสดุ";
  if (carrier === "FLASH") {
    return isValidFlashNumber(normalized)
      ? null
      : "รูปแบบเลข Flash ไม่ถูกต้อง (ขึ้นต้นด้วย TH ตามด้วยตัวอักษร/ตัวเลข เช่น TH12345C6ABC7D)";
  }
  return isValidEmsNumber(normalized)
    ? null
    : "รูปแบบเลข EMS ไม่ถูกต้อง (ต้องเป็นตัวอักษร 2 ตัว + ตัวเลข 9 ตัว + TH เช่น EE123456789TH)";
}

/** Public tracking page for a parcel. */
export function trackingUrl(carrier: string, trackingNumber: string): string {
  const n = encodeURIComponent(trackingNumber);
  if (carrier === "FLASH") return `https://www.flashexpress.co.th/fle/tracking?se=${n}`;
  return `https://track.thailandpost.co.th/?trackNumber=${n}`;
}
