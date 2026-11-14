import { prisma } from "./prisma";

/**
 * สมุดบัญชีรายวัน — ตรรกะคำนวณทั้งหมด (อ่านอย่างเดียวจากตารางเดิม)
 *
 * รายรับอัตโนมัติ = รายการที่ "ยืนยันแล้ว" เท่านั้น (นิยามเดียวกับ lib/salesSummary.ts):
 *   - การจองโต๊ะ (Reservation: confirmed)        วันที่ = วันที่แอดมินตรวจสลิป / วันที่ขายหน้างาน
 *   - ออเดอร์ของที่ระลึก (MerchOrder: confirmed)   วันที่ = วันที่แอดมินตรวจสลิป  (ยอดรวมค่าจัดส่งแล้ว)
 *   - ขายหน้างาน POS (PosSale ทุกใบ)              วันที่ = วันที่ขาย
 *   - ศิษย์เก่าดีเด่น/ผู้สนับสนุน (SupportRegistration: confirmed)  วันที่ = วันที่อนุมัติ (updatedAt)
 * วันที่ทั้งหมดนับตามปฏิทินไทย (Asia/Bangkok, UTC+7)
 *
 * ไฟล์นี้ไม่เขียนอะไรกลับไปที่ตารางออเดอร์/การจองเลย — เขียนเฉพาะ LedgerEntry / DailyClosing
 */

const BKK_OFFSET_MS = 7 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

/** ปิดใช้งานการกรอกรายการเอง + ปิดยอดประจำวัน (ซ่อนทั้งหน้าเว็บและ API ทุกบทบาท) — เปลี่ยนเป็น true เพื่อเปิดกลับ */
export const LEDGER_MANUAL_AND_CLOSING_ENABLED = false;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const isDateStr = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** วันที่ตามปฏิทินไทยของ instant หนึ่ง เป็น "YYYY-MM-DD" */
export function toBkkDateStr(d: Date): string {
  return new Date(d.getTime() + BKK_OFFSET_MS).toISOString().slice(0, 10);
}
export const todayBkk = () => toBkkDateStr(new Date());
/** เวลาเริ่มวัน (00:00 น. ไทย) ของวันที่นั้น */
export const bkkDayStart = (dateStr: string) => new Date(`${dateStr}T00:00:00+07:00`);
/** ค่าที่ใช้เขียนลงคอลัมน์ @db.Date */
export const dbDate = (dateStr: string) => new Date(`${dateStr}T00:00:00Z`);
/** อ่านค่าคอลัมน์ @db.Date กลับเป็น "YYYY-MM-DD" */
export const fromDbDate = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(dateStr: string, n: number): string {
  return new Date(Date.parse(`${dateStr}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export type AutoSource = "reservation" | "merch" | "merch_ship" | "pos" | "support";
export const SOURCE_LABEL: Record<AutoSource, string> = {
  reservation: "จองโต๊ะ",
  merch: "ของที่ระลึก (ออนไลน์) — ค่าสินค้า",
  merch_ship: "ของที่ระลึก (ออนไลน์) — ค่าจัดส่ง",
  pos: "ขายหน้างาน (POS)",
  support: "ศิษย์เก่าดีเด่น/ผู้สนับสนุน",
};
const SOURCES = Object.keys(SOURCE_LABEL) as AutoSource[];

/** หมวดงาน — ใช้จัดกลุ่มรายรับ/รายจ่ายเพื่อดูกำไร-ขาดทุนแยกส่วน (ยังเป็นสมุดบัญชีเล่มเดียว) */
export type Stream = "event" | "merch" | "shipping" | "support" | "general";
export const STREAMS: Stream[] = ["event", "merch", "shipping", "support", "general"];
export const STREAM_LABEL: Record<Stream, string> = {
  event: "งานเลี้ยง (จองโต๊ะ)",
  merch: "ของที่ระลึก",
  shipping: "ค่าจัดส่ง",
  support: "เงินสนับสนุน",
  general: "ทั่วไป",
};
export const isStream = (s: unknown): s is Stream => typeof s === "string" && (STREAMS as string[]).includes(s);
// การจองแพ็กเกจ (โต๊ะ + ของที่ระลึก) ระบบเก็บยอดรวมก้อนเดียว จึงนับเป็น "งานเลี้ยง" ทั้งก้อน
export const SOURCE_STREAM: Record<AutoSource, Stream> = { reservation: "event", merch: "merch", merch_ship: "shipping", pos: "merch", support: "support" };
const CATEGORY_STREAM: Record<string, Stream> = {
  "อาหาร/เครื่องดื่ม": "event",
  "สถานที่/เวที/เครื่องเสียง": "event",
  "ตกแต่ง/ดอกไม้": "event",
  "ผลิตเสื้อ/ของที่ระลึก": "merch",
  "ไปรษณีย์/จัดส่ง": "shipping",
  "เงินบริจาค": "support",
  "ค่าสนับสนุน/สปอนเซอร์ (รับตรง)": "support",
};
/** หมวดงานเริ่มต้นที่เดาจากหมวดรายการ (ผู้ใช้เปลี่ยนเองได้) */
export const defaultStream = (category: string): Stream => CATEGORY_STREAM[category] ?? "general";

export type Method = "cash" | "transfer";

export interface AutoItem {
  source: AutoSource;
  date: string; // YYYY-MM-DD (ไทย)
  method: Method;
  amount: number;
  ref: string; // รหัสการจอง/ออเดอร์/ใบขาย
  name: string | null;
}

/** รายรับอัตโนมัติทุกรายการในช่วงวันที่ [from, to] (รวมปลายทั้งสองข้าง) */
export async function getAutoIncomeItems(from: string, to: string): Promise<AutoItem[]> {
  const gte = bkkDayStart(from);
  const lt = new Date(bkkDayStart(to).getTime() + DAY_MS);
  const inRange = (d: string) => d >= from && d <= to;
  const items: AutoItem[] = [];

  const [reservations, orders, posSales, supports] = await Promise.all([
    // updatedAt ≥ วันที่ยืนยันเสมอ จึงใช้เป็นขอบล่างที่ปลอดภัยเพื่อลดจำนวนแถวที่อ่าน
    prisma.reservation.findMany({
      where: { paymentStatus: "confirmed", updatedAt: { gte } },
      select: { bookingCode: true, bookerName: true, totalAmount: true, createdAt: true, updatedAt: true, cashierId: true, paymentMethod: true, slips: { select: { verifiedAt: true } } },
    }),
    prisma.merchOrder.findMany({
      where: { paymentStatus: "confirmed", updatedAt: { gte } },
      select: { orderCode: true, bookerName: true, totalAmount: true, updatedAt: true, slips: { select: { verifiedAt: true } }, items: { select: { quantity: true, unitPrice: true } } },
    }),
    prisma.posSale.findMany({
      // นับเฉพาะใบที่รับเงินแล้ว — รอชำระ/ยกเลิก ไม่ใช่รายรับ
      where: { createdAt: { gte, lt }, status: "paid" },
      select: { saleCode: true, buyerName: true, totalAmount: true, paymentMethod: true, createdAt: true },
    }),
    prisma.supportRegistration.findMany({
      where: { paymentStatus: "confirmed", updatedAt: { gte } },
      select: { code: true, name: true, amount: true, updatedAt: true },
    }),
  ]);

  const latest = (xs: { verifiedAt: Date | null }[]) =>
    xs.reduce<Date | null>((m, s) => (s.verifiedAt && (!m || s.verifiedAt > m) ? s.verifiedAt : m), null);

  for (const r of reservations) {
    const atCounter = !!r.cashierId; // ขายหน้างาน — ยืนยันทันทีตอนสร้าง
    const when = atCounter ? r.createdAt : latest(r.slips) ?? r.updatedAt;
    const date = toBkkDateStr(when);
    if (!inRange(date)) continue;
    items.push({ source: "reservation", date, method: atCounter && r.paymentMethod === "cash" ? "cash" : "transfer", amount: Number(r.totalAmount), ref: r.bookingCode, name: r.bookerName });
  }
  for (const o of orders) {
    const date = toBkkDateStr(latest(o.slips) ?? o.updatedAt);
    if (!inRange(date)) continue;
    // แยกค่าสินค้า/ค่าจัดส่ง: ค่าจัดส่ง = ยอดรวมที่ลูกค้าจ่ายจริง − ผลรวมราคาสินค้า (ไม่ใช้ช่อง shippingFee เพราะบางออเดอร์ยอดรวมไม่ได้บวกค่าส่ง)
    const total = Number(o.totalAmount);
    const goodsSum = o.items.reduce((a, i) => a + i.quantity * Number(i.unitPrice), 0);
    const ship = round2(Math.min(total, Math.max(0, total - goodsSum)));
    items.push({ source: "merch", date, method: "transfer", amount: round2(total - ship), ref: o.orderCode, name: o.bookerName });
    if (ship > 0) items.push({ source: "merch_ship", date, method: "transfer", amount: ship, ref: o.orderCode, name: o.bookerName });
  }
  for (const s of posSales) {
    const date = toBkkDateStr(s.createdAt);
    if (!inRange(date)) continue;
    items.push({ source: "pos", date, method: s.paymentMethod === "cash" ? "cash" : "transfer", amount: Number(s.totalAmount), ref: s.saleCode, name: s.buyerName });
  }
  for (const g of supports) {
    const date = toBkkDateStr(g.updatedAt);
    if (!inRange(date)) continue;
    items.push({ source: "support", date, method: "transfer", amount: Number(g.amount), ref: g.code, name: g.name });
  }
  return items;
}

export interface AutoTotals {
  total: number;
  cash: number;
  transfer: number;
  count: number;
  bySource: Record<AutoSource, { amount: number; count: number }>;
}
export function totalAuto(items: AutoItem[]): AutoTotals {
  const t: AutoTotals = { total: 0, cash: 0, transfer: 0, count: items.length, bySource: {} as AutoTotals["bySource"] };
  for (const s of SOURCES) t.bySource[s] = { amount: 0, count: 0 };
  for (const i of items) {
    t.total += i.amount;
    t[i.method] += i.amount;
    t.bySource[i.source].amount += i.amount;
    t.bySource[i.source].count += 1;
  }
  t.total = round2(t.total);
  t.cash = round2(t.cash);
  t.transfer = round2(t.transfer);
  for (const s of SOURCES) t.bySource[s].amount = round2(t.bySource[s].amount);
  return t;
}

export interface EntryRow {
  id: string;
  date: string;
  type: "income" | "expense";
  method: Method;
  category: string;
  stream: Stream;
  amount: number;
  description: string | null;
  receiptNo: string | null;
  createdByName: string | null;
  createdAt: string;
  voided: boolean;
  voidReason: string | null;
  voidedByName: string | null;
}
function toEntryRow(e: {
  id: string; entryDate: Date; type: "income" | "expense"; method: Method; category: string; stream: string; amount: unknown;
  description: string | null; receiptNo: string | null; createdByName: string | null; createdAt: Date;
  voidedAt: Date | null; voidReason: string | null; voidedByName: string | null;
}): EntryRow {
  return {
    id: e.id, date: fromDbDate(e.entryDate), type: e.type, method: e.method, category: e.category,
    stream: isStream(e.stream) ? e.stream : "general", amount: Number(e.amount), description: e.description, receiptNo: e.receiptNo, createdByName: e.createdByName,
    createdAt: e.createdAt.toISOString(), voided: !!e.voidedAt, voidReason: e.voidReason, voidedByName: e.voidedByName,
  };
}

export interface ManualTotals {
  income: number;
  expense: number;
  incomeCash: number;
  expenseCash: number;
}
export function totalManual(entries: EntryRow[]): ManualTotals {
  const t: ManualTotals = { income: 0, expense: 0, incomeCash: 0, expenseCash: 0 };
  for (const e of entries) {
    if (e.voided) continue;
    if (e.type === "income") {
      t.income += e.amount;
      if (e.method === "cash") t.incomeCash += e.amount;
    } else {
      t.expense += e.amount;
      if (e.method === "cash") t.expenseCash += e.amount;
    }
  }
  return { income: round2(t.income), expense: round2(t.expense), incomeCash: round2(t.incomeCash), expenseCash: round2(t.expenseCash) };
}

export type StreamTotals = Record<Stream, { income: number; expense: number; net: number }>;
/** รายรับ (อัตโนมัติ + กรอกเอง) และรายจ่ายแยกตามหมวดงาน */
export function totalByStream(items: AutoItem[], entries: EntryRow[]): StreamTotals {
  const t = {} as StreamTotals;
  for (const k of STREAMS) t[k] = { income: 0, expense: 0, net: 0 };
  for (const i of items) t[SOURCE_STREAM[i.source]].income += i.amount;
  for (const e of entries) {
    if (e.voided) continue;
    t[e.stream][e.type] += e.amount;
  }
  for (const k of STREAMS) {
    t[k].income = round2(t[k].income);
    t[k].expense = round2(t[k].expense);
    t[k].net = round2(t[k].income - t[k].expense);
  }
  return t;
}

export interface ClosingInfo {
  closedAt: string;
  closedByName: string | null;
  autoIncome: number;
  manualIncome: number;
  expense: number;
  net: number;
  expectedCash: number;
  countedCash: number | null;
  cashVariance: number | null;
  note: string | null;
}
function toClosingInfo(c: {
  closedAt: Date; closedByName: string | null; autoIncome: unknown; manualIncome: unknown; expense: unknown; net: unknown;
  expectedCash: unknown; countedCash: unknown; note: string | null;
}): ClosingInfo {
  const counted = c.countedCash == null ? null : Number(c.countedCash);
  return {
    closedAt: c.closedAt.toISOString(), closedByName: c.closedByName, autoIncome: Number(c.autoIncome), manualIncome: Number(c.manualIncome),
    expense: Number(c.expense), net: Number(c.net), expectedCash: Number(c.expectedCash), countedCash: counted,
    cashVariance: counted == null ? null : round2(counted - Number(c.expectedCash)), note: c.note,
  };
}

export interface LedgerDay {
  date: string;
  items: AutoItem[];
  auto: AutoTotals;
  entries: EntryRow[];
  manual: ManualTotals;
  byStream: StreamTotals;
  net: number; // รายรับอัตโนมัติ + รายรับกรอกเอง − รายจ่าย
  expectedCash: number;
  closing: ClosingInfo | null;
  /** ถ้าปิดยอดแล้วแต่รายรับอัตโนมัติตอนนี้ไม่ตรงกับตอนปิด (เช่น มีสลิปอนุมัติย้อนหลัง) = ผลต่าง (ตอนนี้ − ตอนปิด) */
  drift: number | null;
}

export async function getLedgerDay(date: string): Promise<LedgerDay> {
  const [items, rows, closing] = await Promise.all([
    getAutoIncomeItems(date, date),
    prisma.ledgerEntry.findMany({ where: { entryDate: dbDate(date) }, orderBy: { createdAt: "asc" } }),
    prisma.dailyClosing.findUnique({ where: { closingDate: dbDate(date) } }),
  ]);
  const auto = totalAuto(items);
  const entries = rows.map(toEntryRow);
  const manual = totalManual(entries);
  const net = round2(auto.total + manual.income - manual.expense);
  const expectedCash = round2(auto.cash + manual.incomeCash - manual.expenseCash);
  const closingInfo = closing ? toClosingInfo(closing) : null;
  return {
    date, items, auto, entries, manual, byStream: totalByStream(items, entries), net, expectedCash, closing: closingInfo,
    drift: closingInfo ? round2(auto.total - closingInfo.autoIncome) : null,
  };
}

export class LedgerError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

/** ปิดยอดประจำวัน — เก็บสแนปช็อตของตัวเลข ณ ตอนนี้ (ไม่แตะออเดอร์ใดๆ) */
export async function closeDay(date: string, admin: { adminId: string; username: string }, opts: { note?: string | null; countedCash?: number | null }) {
  if (date > todayBkk()) throw new LedgerError("FUTURE_DATE", "ปิดยอดล่วงหน้าไม่ได้");
  const day = await getLedgerDay(date);
  if (day.closing) throw new LedgerError("ALREADY_CLOSED", "วันนี้ปิดยอดไปแล้ว", 409);
  const counted = opts.countedCash == null ? null : round2(opts.countedCash);
  try {
    await prisma.dailyClosing.create({
      data: {
        closingDate: dbDate(date),
        autoIncome: day.auto.total,
        manualIncome: day.manual.income,
        expense: day.manual.expense,
        net: day.net,
        expectedCash: day.expectedCash,
        countedCash: counted,
        snapshot: { bySource: day.auto.bySource, cash: day.auto.cash, transfer: day.auto.transfer, itemCount: day.auto.count },
        note: opts.note?.trim() || null,
        closedById: admin.adminId,
        closedByName: admin.username,
      },
    });
  } catch (e: any) {
    if (e?.code === "P2002") throw new LedgerError("ALREADY_CLOSED", "วันนี้ปิดยอดไปแล้ว", 409);
    throw e;
  }
  return getLedgerDay(date);
}

export interface RangeRow {
  date: string;
  auto: number;
  manualIncome: number;
  expense: number;
  net: number;
  closed: boolean;
  closedNet: number | null;
  drift: number | null;
}
export interface LedgerRange {
  from: string;
  to: string;
  rows: RangeRow[];
  totals: { auto: number; manualIncome: number; expense: number; net: number; closedDays: number; openDays: number };
  bySource: AutoTotals["bySource"];
  byStream: StreamTotals;
  expenseByCategory: { category: string; amount: number }[];
}

export async function getLedgerRange(from: string, to: string): Promise<LedgerRange> {
  const [items, rows, closings] = await Promise.all([
    getAutoIncomeItems(from, to),
    prisma.ledgerEntry.findMany({ where: { entryDate: { gte: dbDate(from), lte: dbDate(to) }, voidedAt: null } }),
    prisma.dailyClosing.findMany({ where: { closingDate: { gte: dbDate(from), lte: dbDate(to) } } }),
  ]);
  const entryRows = rows.map(toEntryRow);
  const closingBy = new Map(closings.map((c) => [fromDbDate(c.closingDate), c]));
  const autoBy = new Map<string, number>();
  for (const i of items) autoBy.set(i.date, (autoBy.get(i.date) ?? 0) + i.amount);
  const inBy = new Map<string, number>();
  const exBy = new Map<string, number>();
  const cat = new Map<string, number>();
  for (const e of rows) {
    const d = fromDbDate(e.entryDate);
    const a = Number(e.amount);
    if (e.type === "income") inBy.set(d, (inBy.get(d) ?? 0) + a);
    else {
      exBy.set(d, (exBy.get(d) ?? 0) + a);
      cat.set(e.category, (cat.get(e.category) ?? 0) + a);
    }
  }
  const out: RangeRow[] = [];
  const totals = { auto: 0, manualIncome: 0, expense: 0, net: 0, closedDays: 0, openDays: 0 };
  for (const d of eachDate(from, to)) {
    const a = round2(autoBy.get(d) ?? 0);
    const mi = round2(inBy.get(d) ?? 0);
    const ex = round2(exBy.get(d) ?? 0);
    const c = closingBy.get(d);
    if (!a && !mi && !ex && !c) continue; // ข้ามวันที่ไม่มีความเคลื่อนไหว
    const net = round2(a + mi - ex);
    out.push({ date: d, auto: a, manualIncome: mi, expense: ex, net, closed: !!c, closedNet: c ? Number(c.net) : null, drift: c ? round2(a - Number(c.autoIncome)) : null });
    totals.auto += a; totals.manualIncome += mi; totals.expense += ex; totals.net += net;
    if (c) totals.closedDays++; else totals.openDays++;
  }
  totals.auto = round2(totals.auto); totals.manualIncome = round2(totals.manualIncome); totals.expense = round2(totals.expense); totals.net = round2(totals.net);
  return {
    from, to, rows: out, totals, bySource: totalAuto(items).bySource, byStream: totalByStream(items, entryRows),
    expenseByCategory: [...cat.entries()].map(([category, amount]) => ({ category, amount: round2(amount) })).sort((x, y) => y.amount - x.amount),
  };
}

export const INCOME_CATEGORIES = ["เงินสดรับหน้างาน", "เงินบริจาค", "ค่าสนับสนุน/สปอนเซอร์ (รับตรง)", "อื่นๆ"];
export const EXPENSE_CATEGORIES = [
  "อาหาร/เครื่องดื่ม", "สถานที่/เวที/เครื่องเสียง", "พิมพ์/ป้าย/โปสเตอร์", "ผลิตเสื้อ/ของที่ระลึก",
  "ไปรษณีย์/จัดส่ง", "ตกแต่ง/ดอกไม้", "ค่าตอบแทน/ค่าแรง", "อื่นๆ",
];

export { toEntryRow };
