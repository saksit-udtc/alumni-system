import { prisma } from "./prisma";
import { releaseReservation } from "./releaseReservation";

/**
 * ปล่อย "ร่างที่หมดเวลา" ทั้งโต๊ะและของที่ระลึก — จุดเดียวที่ทำงานนี้ (นโยบายเวลาอยู่ที่ lib/holdPolicy.ts)
 *
 *  - การจอง (pending/awaiting_verify ที่ reservedUntil < now) → releaseReservation(..., "expired")
 *    คืนที่นั่งโต๊ะ + คืนสต็อกของที่ระลึกในแพ็กเกจ
 *  - ออเดอร์ของที่ระลึกที่ยังไม่แนบสลิป (pending ที่ reservedUntil < now) → expired + คืนสต็อก
 *    (ออเดอร์ที่แนบสลิปแล้วไม่หมดเวลาเอง: reservedUntil = null)
 *
 * เรียกซ้ำได้ปลอดภัย: ทุกการเปลี่ยนสถานะเป็น updateMany แบบมีเงื่อนไขสถานะ ใครมาทีหลังได้ count = 0
 * แล้วข้าม จึงไม่คืนสต็อกซ้ำ แม้หลาย request รันพร้อมกัน
 */
export async function releaseExpiredHolds(): Promise<{ reservations: number; merchOrders: number }> {
  const now = new Date();
  let reservations = 0;
  let merchOrders = 0;

  const expiredReservations = await prisma.reservation.findMany({
    where: { paymentStatus: { in: ["pending", "awaiting_verify"] }, reservedUntil: { lt: now } },
    select: { id: true, bookingCode: true },
  });
  for (const r of expiredReservations) {
    try {
      await releaseReservation(r.id, "expired");
      reservations++;
    } catch (err) {
      console.error(`[releaseExpired] failed to release reservation ${r.bookingCode}:`, err);
    }
  }

  const expiredOrders = await prisma.merchOrder.findMany({
    where: { paymentStatus: "pending", reservedUntil: { lt: now } },
    select: { id: true, orderCode: true },
  });
  for (const o of expiredOrders) {
    try {
      const released = await prisma.$transaction(async (tx) => {
        // เงื่อนไขสถานะ + เวลา ใน WHERE เดียวกัน: ถ้าลูกค้าเพิ่งแนบสลิปทัน (เป็น awaiting_verify)
        // หรือมีใครคืนสต็อกไปแล้ว จะได้ count = 0 และไม่แตะสต็อก
        const moved = await tx.merchOrder.updateMany({
          where: { id: o.id, paymentStatus: "pending", reservedUntil: { lt: new Date() } },
          data: { paymentStatus: "expired" },
        });
        if (moved.count === 0) return false;

        const items = await tx.merchOrderItem.findMany({ where: { orderId: o.id } });
        for (const item of items) {
          if (!item.productId) continue;
          const existing = await tx.merchProductStock.findFirst({
            where: { productId: item.productId, size: item.size },
          });
          if (existing) {
            await tx.merchProductStock.update({
              where: { id: existing.id },
              data: { quantity: { increment: item.quantity } },
            });
          } else {
            await tx.merchProductStock.create({
              data: { productId: item.productId, size: item.size, quantity: item.quantity },
            });
          }
        }
        return true;
      });
      if (released) merchOrders++;
    } catch (err) {
      console.error(`[releaseExpired] failed to release merch order ${o.orderCode}:`, err);
    }
  }

  if (reservations || merchOrders) {
    console.log(`[releaseExpired] released ${reservations} reservation(s), ${merchOrders} merch order(s)`);
  }
  return { reservations, merchOrders };
}

let lastSweep = 0;
/** กวาดแบบจำกัดความถี่ (ไม่เกิน 1 ครั้ง/20 วินาที) — เรียกจาก API ที่แสดงสต็อก/โต๊ะว่าง
 * เพื่อให้ตัวเลขที่ลูกค้าเห็นสดเสมอ ไม่ต้องรอรอบตัวตั้งเวลา; ไม่ throw */
export async function sweepExpiredThrottled(minIntervalMs = 20_000): Promise<void> {
  const nowMs = Date.now();
  if (nowMs - lastSweep < minIntervalMs) return;
  lastSweep = nowMs;
  try {
    await releaseExpiredHolds();
  } catch (err) {
    console.error("[releaseExpired] sweep failed:", err);
  }
}
