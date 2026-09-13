/**
 * Generates a Thai PromptPay EMV QR Code payload string — the same text
 * format a banking app reads when you scan any PromptPay QR. Pure string
 * math (TLV encoding + CRC16), no external API/library and no server-only
 * APIs (no Buffer/crypto), so this can be imported from either a server
 * route or a "use client" component that renders it with the existing
 * `qrcode` package (see app/components/qr-code.tsx).
 *
 * Reference: the standard PromptPay QR spec used by every Thai bank app —
 * merchant account info tag 29 with application ID A000000677010111, sub-
 * tag 01 for a mobile number, 02 for a 13-digit national/tax ID, 03 for a
 * 15-digit e-Wallet ID; tag 54 carries the amount when present (a
 * "dynamic" QR); tag 63 is a CRC16/CCITT-FALSE checksum over everything
 * before it, including its own "6304" tag+length prefix.
 */

function serialize(id: string, value: string): string {
  const length = value.length.toString().padStart(2, "0");
  return `${id}${length}${value}`;
}

// CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, no input/output reflection.
// Implemented over char codes rather than Buffer so it works in the
// browser too — every character in a PromptPay payload is ASCII, so
// charCodeAt(i) is exactly the byte value.
function crc16ccitt(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export class PromptPayError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** True if `target` is a shape isValidPromptPayTarget accepts — a 10-digit
 * mobile number starting with 0, a 13-digit national/tax ID, or a 15-digit
 * e-Wallet ID (formatting characters like spaces/dashes are ignored). */
export function isValidPromptPayTarget(target: string): boolean {
  const numbers = target.replace(/[^0-9]/g, "");
  return /^0[0-9]{9}$/.test(numbers) || /^[0-9]{13}$/.test(numbers) || /^[0-9]{15}$/.test(numbers);
}

/**
 * Builds the QR payload string for `target` (a PromptPay-registered mobile
 * number, national ID, tax ID, or e-Wallet ID) and, when given, a fixed
 * `amount` in THB (a "dynamic" QR pre-filled with the exact total — the
 * customer's banking app shows the amount and just needs a confirm tap).
 */
export function generatePromptPayPayload(target: string, amount?: number): string {
  const numbers = target.replace(/[^0-9]/g, "");
  let targetType: string;
  let value: string;
  if (/^0[0-9]{9}$/.test(numbers)) {
    targetType = "01"; // mobile number: country code 66 + number without the leading 0
    value = "0066" + numbers.substring(1);
  } else if (/^[0-9]{13}$/.test(numbers)) {
    targetType = "02"; // national ID / juristic (tax) ID
    value = numbers;
  } else if (/^[0-9]{15}$/.test(numbers)) {
    targetType = "03"; // e-Wallet ID
    value = numbers;
  } else {
    throw new PromptPayError("INVALID_TARGET", "รูปแบบเลขพร้อมเพย์ไม่ถูกต้อง (ต้องเป็นเบอร์โทร 10 หลัก หรือเลขบัตร/นิติบุคคล 13 หลัก)");
  }

  const merchantAccountInfo = serialize("00", "A000000677010111") + serialize(targetType, value);

  const fields = [serialize("00", "01"), serialize("01", amount != null ? "12" : "11"), serialize("29", merchantAccountInfo), serialize("53", "764")];
  if (amount != null) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new PromptPayError("INVALID_AMOUNT", "ยอดเงินไม่ถูกต้อง");
    }
    fields.push(serialize("54", amount.toFixed(2)));
  }
  fields.push(serialize("58", "TH"));

  const payloadWithoutCrc = fields.join("") + "6304";
  return payloadWithoutCrc + crc16ccitt(payloadWithoutCrc);
}
