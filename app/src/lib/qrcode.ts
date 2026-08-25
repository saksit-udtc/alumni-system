import QRCode from "qrcode";
import crypto from "crypto";

export function generateQrToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function generateBookingCode(): string {
  // 8-char human-friendly code, uppercase alphanumeric, ambiguous chars removed
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

export function checkinUrl(qrCodeToken: string): string {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  return `${base}/admin/checkin/${qrCodeToken}`;
}

export async function generateQrPngBuffer(data: string): Promise<Buffer> {
  return QRCode.toBuffer(data, { type: "png", width: 400, margin: 2 });
}
