/**
 * Shipment helpers shared by the admin API, the public status API and the
 * shipped-notification email.
 */

// Thailand Post EMS numbers: 2 letters + 9 digits + "TH" (13 chars), e.g. EE123456789TH.
const EMS_PATTERN = /^[A-Z]{2}\d{9}TH$/;

/** Uppercases and strips spaces/dashes, so "ee 123-456-789 th" -> "EE123456789TH". */
export function normalizeTrackingNumber(raw: string): string {
  return raw.replace(/[\s-]+/g, "").toUpperCase();
}

export function isValidEmsNumber(normalized: string): boolean {
  return EMS_PATTERN.test(normalized);
}

/** Public tracking page for a parcel. Only Thailand Post is supported for now. */
export function trackingUrl(carrier: string, trackingNumber: string): string {
  return `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(trackingNumber)}`;
}
