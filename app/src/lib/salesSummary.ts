import { prisma } from "./prisma";

/**
 * สรุปยอดสำหรับหน้า /admin/merch/summary — จำนวนสินค้าที่ระลึกที่ถูกสั่ง (แยกสินค้า/ไซซ์/สถานะ/ช่องทาง)
 * และจำนวนโต๊ะที่ถูกจอง (แยกงาน/โซน/สถานะ) คำนวณสดจากฐานข้อมูลทุกครั้ง ไม่แก้ข้อมูลใดๆ
 * ไม่นับรายการที่ถูกปฏิเสธ (rejected) หรือหมดเวลา (expired)
 */

export type Bucket = "confirmed" | "awaiting" | "pending";
const BUCKET_OF: Record<string, Bucket | null> = {
  confirmed: "confirmed",
  awaiting_verify: "awaiting",
  pending: "pending",
  rejected: null,
  expired: null,
};

export const SIZE_ORDER = ["SS", "S", "M", "L", "XL", "2XL", "3XL", "3L", "4XL", "4L", "5XL", "5L", "6XL", "6L", "7XL", "7L", "8XL", "8L"];
function sizeRank(s: string | null) {
  if (!s) return -1;
  const i = SIZE_ORDER.indexOf(s.toUpperCase());
  return i === -1 ? 999 : i;
}

export interface MerchRow {
  productName: string;
  size: string | null;
  confirmed: number;
  awaiting: number;
  pending: number;
  total: number;
  online: number; // สั่งออนไลน์ (รวมแพ็กเกจของที่ระลึกที่สั่งออนไลน์)
  pos: number; // ขายหน้างาน (ชำระแล้วทั้งหมด)
  withTable: number; // ของในแพ็กเกจจองโต๊ะ
  revenueConfirmed: number; // ยอดเงินที่ยืนยันแล้ว (ไม่รวมของในแพ็กเกจจองโต๊ะ ซึ่งไม่มีราคาแยก)
}

export interface ZoneRow {
  zone: string;
  tables: number;
  confirmed: number;
  awaiting: number;
  pending: number;
  free: number;
}

export interface EventTableSummary {
  eventId: string;
  eventName: string;
  eventDate: string;
  totalTables: number;
  totalSeats: number;
  tables: Record<Bucket, number>; // จำนวนโต๊ะที่มีการจอง จัดตามสถานะที่ "ดีที่สุด" ของโต๊ะนั้น
  freeTables: number;
  fullTableBookings: Record<Bucket, number>;
  seatBookings: Record<Bucket, number>; // จำนวนการจองแบบรายที่นั่ง
  seats: Record<Bucket, number>; // จำนวนที่นั่งรวม (ทั้งจองเต็มโต๊ะและรายที่นั่ง)
  revenue: Record<Bucket, number>;
  zones: ZoneRow[];
}

export interface SalesSummary {
  generatedAt: string;
  merch: MerchRow[];
  merchTotals: Omit<MerchRow, "productName" | "size">;
  events: EventTableSummary[];
}

const zero = (): Record<Bucket, number> => ({ confirmed: 0, awaiting: 0, pending: 0 });

export async function getSalesSummary(): Promise<SalesSummary> {
  const active = { in: ["confirmed", "awaiting_verify", "pending"] as any };

  const [orderItems, posItems, resvItems, products, events] = await Promise.all([
    prisma.merchOrderItem.findMany({
      where: { order: { paymentStatus: active } },
      select: { productId: true, productName: true, size: true, quantity: true, unitPrice: true, order: { select: { paymentStatus: true } } },
    }),
    prisma.posSaleItem.findMany({ select: { productId: true, productName: true, size: true, quantity: true, unitPrice: true } }),
    prisma.reservationPackageItem.findMany({
      where: { reservation: { paymentStatus: active } },
      select: { productId: true, productName: true, size: true, quantity: true, reservation: { select: { paymentStatus: true } } },
    }),
    prisma.merchProduct.findMany({ select: { id: true, name: true, sortOrder: true } }),
    prisma.event.findMany({
      orderBy: { eventDate: "asc" },
      select: {
        id: true,
        name: true,
        eventDate: true,
        tables: { select: { id: true, capacity: true, zone: true } },
        reservations: {
          where: { paymentStatus: active },
          select: { tableId: true, bookingType: true, seatCount: true, paymentStatus: true, totalAmount: true },
        },
      },
    }),
  ]);

  // ---------- ของที่ระลึก ----------
  const productById = new Map(products.map((p) => [p.id, p]));
  const rows = new Map<string, MerchRow & { sort: number }>();
  function row(productId: string | null, productName: string, size: string | null) {
    const p = productId ? productById.get(productId) : undefined;
    const name = p?.name ?? productName;
    const sz = size || null;
    const key = `${productId ?? name}|${sz ?? ""}`;
    let r = rows.get(key);
    if (!r) {
      r = { productName: name, size: sz, confirmed: 0, awaiting: 0, pending: 0, total: 0, online: 0, pos: 0, withTable: 0, revenueConfirmed: 0, sort: p?.sortOrder ?? 9999 };
      rows.set(key, r);
    }
    return r;
  }
  for (const it of orderItems) {
    const b = BUCKET_OF[it.order.paymentStatus];
    if (!b) continue;
    const r = row(it.productId, it.productName, it.size);
    r[b] += it.quantity;
    r.total += it.quantity;
    r.online += it.quantity;
    if (b === "confirmed") r.revenueConfirmed += it.quantity * Number(it.unitPrice);
  }
  for (const it of posItems) {
    const r = row(it.productId, it.productName, it.size);
    r.confirmed += it.quantity;
    r.total += it.quantity;
    r.pos += it.quantity;
    r.revenueConfirmed += it.quantity * Number(it.unitPrice);
  }
  for (const it of resvItems) {
    const b = BUCKET_OF[it.reservation.paymentStatus];
    if (!b) continue;
    const r = row(it.productId, it.productName, it.size);
    r[b] += it.quantity;
    r.total += it.quantity;
    r.withTable += it.quantity;
  }
  const merch = [...rows.values()]
    .sort((a, b) => a.sort - b.sort || a.productName.localeCompare(b.productName, "th") || sizeRank(a.size) - sizeRank(b.size))
    .map(({ sort, ...r }) => r);
  const merchTotals = merch.reduce(
    (t, r) => {
      for (const k of ["confirmed", "awaiting", "pending", "total", "online", "pos", "withTable", "revenueConfirmed"] as const) t[k] += r[k];
      return t;
    },
    { confirmed: 0, awaiting: 0, pending: 0, total: 0, online: 0, pos: 0, withTable: 0, revenueConfirmed: 0 }
  );

  // ---------- โต๊ะ ----------
  const RANK: Record<Bucket, number> = { confirmed: 3, awaiting: 2, pending: 1 };
  const eventSummaries: EventTableSummary[] = events
    .filter((e) => e.tables.length > 0 || e.reservations.length > 0)
    .map((e) => {
      const s: EventTableSummary = {
        eventId: e.id,
        eventName: e.name,
        eventDate: e.eventDate.toISOString(),
        totalTables: e.tables.length,
        totalSeats: e.tables.reduce((n, t) => n + t.capacity, 0),
        tables: zero(),
        freeTables: 0,
        fullTableBookings: zero(),
        seatBookings: zero(),
        seats: zero(),
        revenue: zero(),
        zones: [],
      };
      const tableBest = new Map<string, Bucket>();
      for (const r of e.reservations) {
        const b = BUCKET_OF[r.paymentStatus];
        if (!b) continue;
        if (r.bookingType === "full_table") s.fullTableBookings[b]++;
        else s.seatBookings[b]++;
        s.seats[b] += r.seatCount;
        s.revenue[b] += Number(r.totalAmount);
        const cur = tableBest.get(r.tableId);
        if (!cur || RANK[b] > RANK[cur]) tableBest.set(r.tableId, b);
      }
      const zones = new Map<string, ZoneRow>();
      for (const t of e.tables) {
        const zName = t.zone?.trim() || "ไม่ระบุโซน";
        let z = zones.get(zName);
        if (!z) {
          z = { zone: zName, tables: 0, confirmed: 0, awaiting: 0, pending: 0, free: 0 };
          zones.set(zName, z);
        }
        z.tables++;
        const b = tableBest.get(t.id);
        if (b) {
          s.tables[b]++;
          z[b]++;
        } else {
          s.freeTables++;
          z.free++;
        }
      }
      s.zones = [...zones.values()].sort((a, b) => a.zone.localeCompare(b.zone, "th"));
      return s;
    });

  return { generatedAt: new Date().toISOString(), merch, merchTotals, events: eventSummaries };
}
