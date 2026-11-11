import { prisma } from "./prisma";

// แยกจาก posSale.ts เพราะไฟล์นั้น import "crypto" ซึ่งคอมไพล์ใน instrumentation.ts (releaseExpired → ที่นี่) ไม่ได้

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** คืนสต๊อกของใบขายหนึ่งใบ (ใช้ตอนยกเลิก/หมดเวลา) — หาแถวสต๊อกจากบาร์โค้ดก่อน ไม่มีค่อยใช้สินค้า+ไซส์ */
async function restoreSaleStock(tx: Tx, saleId: string) {
  const items = await tx.posSaleItem.findMany({ where: { saleId } });
  for (const item of items) {
    let stock = item.barcode ? await tx.merchProductStock.findUnique({ where: { barcode: item.barcode } }) : null;
    if (!stock && item.productId) {
      stock = await tx.merchProductStock.findFirst({ where: { productId: item.productId, size: item.size } });
    }
    if (stock) {
      await tx.merchProductStock.update({ where: { id: stock.id }, data: { quantity: { increment: item.quantity } } });
    } else if (item.productId) {
      await tx.merchProductStock.create({ data: { productId: item.productId, size: item.size, quantity: item.quantity } });
    }
  }
}

/** ยกเลิกใบ "รอชำระ" + คืนสต๊อก — เรียกซ้ำปลอดภัย (updateMany มีเงื่อนไขสถานะ ใครมาทีหลังได้ count = 0 จึงไม่คืนซ้ำ) */
export async function cancelPendingPosSale(saleId: string, reason: "manual" | "expired"): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const moved = await tx.posSale.updateMany({
      where: { id: saleId, status: "pending" },
      data: { status: "cancelled", cancelledAt: new Date(), cancelReason: reason },
    });
    if (moved.count === 0) return false;
    await restoreSaleStock(tx, saleId);
    return true;
  });
}

/** ปล่อยใบโอนเงินที่หมดเวลา (pending และ holdUntil < now) — เรียกจาก lib/releaseExpired.ts */
export async function releaseExpiredPosSales(): Promise<number> {
  const expired = await prisma.posSale.findMany({
    where: { status: "pending", holdUntil: { lt: new Date() } },
    select: { id: true, saleCode: true },
  });
  let released = 0;
  for (const s of expired) {
    try {
      if (await cancelPendingPosSale(s.id, "expired")) released++;
    } catch (err) {
      console.error(`[releaseExpired] failed to release POS sale ${s.saleCode}:`, err);
    }
  }
  return released;
}
