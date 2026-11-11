import { prisma } from "@/lib/prisma";

// สรุปยอดขายหน้างาน (POS) รายวัน — นับเฉพาะใบที่ "ชำระแล้ว" (paid) ตามวันที่รับเงิน (paidAt)
// วันที่ทั้งหมดนับตามปฏิทินไทย (Asia/Bangkok, UTC+7)

const BKK_MS = 7 * 3600 * 1000;
export const bkkDateKey = (d: Date) => new Date(d.getTime() + BKK_MS).toISOString().slice(0, 10);
export const bkkTime = (d: Date) => new Date(d.getTime() + BKK_MS).toISOString().slice(11, 16);
const dayStart = (s: string) => new Date(`${s}T00:00:00+07:00`);

export const isDateStr = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export interface DailyRow {
  date: string;
  bills: number;
  items: number;
  cash: number;
  cashBills: number;
  transfer: number;
  transferBills: number;
  total: number;
}
export interface ProductRow {
  productName: string;
  size: string | null;
  qty: number;
  amount: number;
}
export interface BillRow {
  date: string;
  time: string;
  saleCode: string;
  cashier: string;
  method: "cash" | "transfer";
  buyer: string;
  items: number;
  total: number;
}
export interface DailyProductRow extends ProductRow {
  date: string;
}
export interface PosDailySummary {
  from: string;
  to: string;
  days: DailyRow[];
  totals: Omit<DailyRow, "date">;
  products: ProductRow[];
  dailyProducts: DailyProductRow[];
  bills: BillRow[];
  pendingNow: number;
  generatedAt: string;
}

export async function getPosDailySummary(from: string, to: string): Promise<PosDailySummary> {
  const gte = dayStart(from);
  const lt = new Date(dayStart(to).getTime() + 24 * 3600 * 1000);

  const [sales, pendingNow] = await Promise.all([
    prisma.posSale.findMany({
      where: { status: "paid", paidAt: { gte, lt } },
      orderBy: { paidAt: "asc" },
      include: { items: true, cashier: { select: { username: true } } },
    }),
    prisma.posSale.count({ where: { status: "pending" } }),
  ]);

  const dayMap = new Map<string, DailyRow>();
  const prodMap = new Map<string, ProductRow>();
  const dayProdMap = new Map<string, DailyProductRow>();
  const bills: BillRow[] = [];

  for (const s of sales) {
    const at = s.paidAt as Date;
    const date = bkkDateKey(at);
    const total = Number(s.totalAmount);
    const qty = s.items.reduce((a, it) => a + it.quantity, 0);
    const d = dayMap.get(date) ?? { date, bills: 0, items: 0, cash: 0, cashBills: 0, transfer: 0, transferBills: 0, total: 0 };
    d.bills += 1;
    d.items += qty;
    d.total += total;
    if (s.paymentMethod === "cash") {
      d.cash += total;
      d.cashBills += 1;
    } else {
      d.transfer += total;
      d.transferBills += 1;
    }
    dayMap.set(date, d);

    for (const it of s.items) {
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

    bills.push({
      date,
      time: bkkTime(at),
      saleCode: s.saleCode,
      cashier: s.cashier.username,
      method: s.paymentMethod,
      buyer: [s.buyerName, s.buyerPhone].filter(Boolean).join(" "),
      items: qty,
      total,
    });
  }

  const days = Array.from(dayMap.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
  const totals = days.reduce(
    (t, d) => ({
      bills: t.bills + d.bills,
      items: t.items + d.items,
      cash: t.cash + d.cash,
      cashBills: t.cashBills + d.cashBills,
      transfer: t.transfer + d.transfer,
      transferBills: t.transferBills + d.transferBills,
      total: t.total + d.total,
    }),
    { bills: 0, items: 0, cash: 0, cashBills: 0, transfer: 0, transferBills: 0, total: 0 },
  );

  return {
    from,
    to,
    days,
    totals,
    products: Array.from(prodMap.values()).sort((a, b) => b.amount - a.amount),
    dailyProducts: Array.from(dayProdMap.values()).sort((a, b) => (a.date === b.date ? b.amount - a.amount : a.date < b.date ? -1 : 1)),
    bills,
    pendingNow,
    generatedAt: new Date().toISOString(),
  };
}
