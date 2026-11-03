// นโยบายเวลา "กันโต๊ะ" (Reservation.reservedUntil) — จุดเดียวที่กำหนดตัวเลข
//
// cron (cron/src/index.ts) ปล่อยโต๊ะเมื่อ paymentStatus เป็น pending หรือ awaiting_verify
// และ reservedUntil < now ดังนั้นตัวเลขที่นี่คือ "เวลาสูงสุดที่โต๊ะถูกกันไว้ก่อนหลุดเอง"
//
// - pending: ยังไม่ได้แนบสลิป — ลูกค้ากรอกข้อมูลแล้วระบบสร้าง "ร่าง" กันโต๊ะ/สินค้าไว้ทันที
//   (ฟอร์ม 2 ขั้น: กรอกข้อมูล → หน้าชำระเงิน) ใช้ทั้งโต๊ะและของที่ระลึก
//   30 นาที = พอให้สแกนจ่ายผ่านแอปธนาคาร/กลับมาแนบสลิป แต่ไม่นานเกินจนของ/โต๊ะหายจากหน้าร้าน
// - awaiting_verify: แนบสลิปแล้ว รอเจ้าหน้าที่ตรวจ — ผู้จองทำครบขั้นตอนแล้ว
//   ความล่าช้าเป็นฝั่งแอดมิน (ไม่ได้อยู่หน้าจอตลอดเวลา) จึงไม่ควรทำให้โต๊ะหลุดใน 20 นาที
//   ตั้งเป็น 48 ชม. เป็นตาข่ายนิรภัยกันโต๊ะค้างถาวรจากการจองที่ถูกลืม/สลิปปลอมที่ไม่มีใครปฏิเสธ
export const PENDING_HOLD_MINUTES = 30;
export const AWAITING_VERIFY_HOLD_HOURS = 48;

/** ของที่ระลึก: กันสต็อกเฉพาะตอนยังไม่แนบสลิป — แนบแล้ว (awaiting_verify) ไม่หมดเวลาเอง
 * เพราะลูกค้าจ่ายแล้ว ห้ามให้ออเดอร์ที่รอแอดมินตรวจถูกยกเลิกอัตโนมัติ */
export function merchHoldUntil(status: "pending" | "awaiting_verify", from: number = Date.now()): Date | null {
  return status === "pending" ? new Date(from + PENDING_HOLD_MINUTES * 60 * 1000) : null;
}

export function holdUntil(status: "pending" | "awaiting_verify", from: number = Date.now()): Date {
  const ms =
    status === "awaiting_verify"
      ? AWAITING_VERIFY_HOLD_HOURS * 60 * 60 * 1000
      : PENDING_HOLD_MINUTES * 60 * 1000;
  return new Date(from + ms);
}
