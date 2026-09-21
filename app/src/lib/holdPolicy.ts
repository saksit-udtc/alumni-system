// นโยบายเวลา "กันโต๊ะ" (Reservation.reservedUntil) — จุดเดียวที่กำหนดตัวเลข
//
// cron (cron/src/index.ts) ปล่อยโต๊ะเมื่อ paymentStatus เป็น pending หรือ awaiting_verify
// และ reservedUntil < now ดังนั้นตัวเลขที่นี่คือ "เวลาสูงสุดที่โต๊ะถูกกันไว้ก่อนหลุดเอง"
//
// - pending: ยังไม่ได้แนบสลิป (เช่น กรอกจองแต่ยังไม่โอน) — ปล่อยเร็วเพื่อไม่ให้โต๊ะค้างจากคนที่ทิ้งไป
// - awaiting_verify: แนบสลิปแล้ว รอเจ้าหน้าที่ตรวจ — ผู้จองทำครบขั้นตอนแล้ว
//   ความล่าช้าเป็นฝั่งแอดมิน (ไม่ได้อยู่หน้าจอตลอดเวลา) จึงไม่ควรทำให้โต๊ะหลุดใน 20 นาที
//   ตั้งเป็น 48 ชม. เป็นตาข่ายนิรภัยกันโต๊ะค้างถาวรจากการจองที่ถูกลืม/สลิปปลอมที่ไม่มีใครปฏิเสธ
export const PENDING_HOLD_MINUTES = 20;
export const AWAITING_VERIFY_HOLD_HOURS = 48;

export function holdUntil(status: "pending" | "awaiting_verify", from: number = Date.now()): Date {
  const ms =
    status === "awaiting_verify"
      ? AWAITING_VERIFY_HOLD_HOURS * 60 * 60 * 1000
      : PENDING_HOLD_MINUTES * 60 * 1000;
  return new Date(from + ms);
}
