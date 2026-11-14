import { prisma } from "@/lib/prisma";
import { bkkDateKey, bkkTime } from "@/lib/posDailySummary";
import { MERCH_PICKUP_ADDRESS_TEXT } from "@/lib/settings";

// สรุปยอดขายออนไลน์ (คำสั่งซื้อของที่ระลึก) รายวัน — นับเฉพาะออเดอร์ที่ "ยืนยันแล้ว" (confirmed)
// วันที่ = วันที่ยืนยันสลิปล่าสุด (ไม่มีให้ใช้ updatedAt) ตรงกับหลักของสมุดบัญชีรายวัน
// แยก ค่าสินค้า / ค่าจัดส่ง (ค่าจัดส่ง = ยอดรวมที่จ่ายจริง − ผลรวมราคาสินค้า) วันที่ทั้งหมดตามปฏิทินไทย

const dayStart = (s: string) => new Date(`${s}T00:00:00+07:00`);
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface OnlineDailyRow {
  date: string;
  orders: number;
  items: number;
  goods: number;
  shipping: number;
  total: number;
}
export interface OnlineProductRow {
  productName: string;
  size: string | null;
  qty: number;
  amount: number;
}
export interface OnlineDailyProductRow extends OnlineProductRow {
  date: string;
}
export interface OnlineOrderRow {
  date: string;
  time: string;
  orderCode: string;
  buyer: string;
  delivery: "ส่งพัสดุ" | "รับที่วิทยาลัย";
  items: number;
  goods: number;
  shipping: number;
  total: number;
}
export interface OnlineDailySummary {
  from: string;
  to: string;
  days: OnlineDailyRow[];
  totals: Omit<OnlineDailyRow, "date">;
  products: OnlineProductRow[];
  dailyProducts: OnlineDailyProductRow[];
  orders: OnlineOrderRow[];
  awaitingNow: number; // รอตรวจสลิป (ยังไม่นับในยอด)
  generatedAt: string;
}

export async function getOnlineDailySummary(from: string, to: string): Promise<OnlineDailySummary> {
  const gte = dayStart(from);
  const lt = new Date(dayStart(to).getTime() + 24 * 3600 * 1000);

  const [rows, awaitingNow] = await Promise.all([
    // updatedAt ≥ วันที่ยืนยันเสมอ จึงใช้เป็นขอบล่างที่ปลอดภัย
    prisma.merchOrder.findMany({
      where: { paymentStatus: "confirmed", updatedAt: { gte } },
      select: {
        orderCode: true,
        bookerName: true,
        bookerPhone: true,
        totalAmount: true,
        shippingAddress: true,
        updatedAt: true,
        slips: { select: { verifiedAt: true } },
        items: { select: { productName: true, size: true, quantity: true, unitPrice: true } },
      },
    }),
    prisma.merchOrder.count({ where: { paymentStatus: "awaiting_verify" } }),
  ]);

  const dayMap = new Map<string, OnlineDailyRow>();
  const prodMap = new Map<string, OnlineProductRow>();
  const dayProdMap = new Map<string, OnlineDailyProductRow>();
  const orders: OnlineOrderRow[] = [];

  for (const o of rows) {
    const at = o.slips.reduce<Date | null>((m, s) => (s.verifiedAt && (!m || s.verifiedAt > m) ? s.verifiedAt : m), null) ?? o.updatedAt;
    if (at < gte || at >= lt) continue;
    const date = bkkDateKey(at);
    const total = Number(o.totalAmount);
    const goodsSum = o.items.reduce((a, i) => a + i.quantity * Number(i.unitPrice), 0);
    const shipping = round2(Math.min(total, Math.max(0, total - goodsSum)));
    const goods = round2(total - shipping);
    const qty = o.items.reduce((a, i) => a + i.quantity, 0);

    const d = dayMap.get(date) ?? { date, orders: 0, items: 0, goods: 0, shipping: 0, total: 0 };
    d.orders += 1;
    d.items += qty;
    d.goods = round2(d.goods + goods);
    d.shipping = round2(d.shipping + shipping);
    d.total = round2(d.total + total);
    dayMap.set(date, d);

    for (const it of o.items) {
      const amount = Number(it.unitPrice) * it.quantity;
      const pk = `${it.productName}|${it.size ?? ""}`;
      const p = prodMap.get(pk) ?? { productName: it.productName, size: it.size, qty: 0, amount: 0 };
      p.qty += it.quantity;
      p.amount += amount;
      prodMap.set(pk, p);
      const dk = `${date}|${pk}`;
      const dp = dayProdMap.get(dk) ?? { date, productName: it.productName, size: it.size, qty: 0, amount: 0 };
      dp.qty += it.quantity;
      dp.amount += amount;
      dayProdMap.set(dk, dp);
    }

    orders.push({
      date,
      time: bkkTime(at),
      orderCode: o.orderCode,
      buyer: [o.bookerName, o.bookerPhone].filter(Boolean).join(" "),
      delivery: o.shippingAddress === MERCH_PICKUP_ADDRESS_TEXT ? "รับที่วิทยาลัย" : "ส่งพัสดุ",
      items: qty,
      goods,
      shipping,
      total,
    });
  }

  orders.sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
  const days = Array.from(dayMap.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
  const totals = days.reduce(
    (t, d) => ({
      orders: t.orders + d.orders,
      items: t.items + d.items,
      goods: round2(t.goods + d.goods),
      shipping: round2(t.shipping + d.shipping),
      total: round2(t.total + d.total),
    }),
    { orders: 0, items: 0, goods: 0, shipping: 0, total: 0 },
  );

  return {
    from,
    to,
    days,
    totals,
    products: Array.from(prodMap.values()).sort((a, b) => b.amount - a.amount),
    dailyProducts: Array.from(dayProdMap.values()).sort((a, b) => (a.date === b.date ? b.amount - a.amount : a.date < b.date ? -1 : 1)),
    orders,
    awaitingNow,
    generatedAt: new Date().toISOString(),
  };
}
