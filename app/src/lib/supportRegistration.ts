import crypto from "crypto";
import type { SupportType } from "./supportConfig";

// ฝั่ง server เท่านั้น (ใช้ node crypto) — ค่าคงที่อยู่ใน supportConfig.ts
export function generateSupportCode(type: SupportType): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[bytes[i] % alphabet.length];
  return `${type === "sponsor" ? "SP" : "DA"}-${code}`;
}
