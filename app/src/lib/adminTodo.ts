import { prisma } from "@/lib/prisma";
import type { AdminRole } from "@/lib/auth";

/**
 * "งานค้าง" ของเจ้าหน้าที่แต่ละบทบาท — ใช้กับกระดิ่งแจ้งเตือนบนแถบบนของหน้า admin
 * และตัวเลขป้ายข้างเมนู. ตัวเลขเหล่านี้ต้องตรงกับรายการ "งานที่ต้องทำ" ในแดชบอร์ด
 * (api/admin/dashboard) จึงใช้ค่าคงที่ชุดเดียวกัน.
 *
 * แต่ละบทบาทได้เห็นเฉพาะงานที่ "หน้าเมนูและ API ของบทบาทนั้นเข้าถึงได้จริง"
 * (ดู requireAdmin ในแต่ละ route และ NAV_ITEMS ใน admin/layout.tsx).
 */

// ผลตรวจสลิป EasySlip ที่ต้องให้เจ้าหน้าที่ดูเป็นพิเศษ (SKIPPED/MATCH ไม่นับ)
export const SUSPICIOUS_SLIP = ["AMOUNT_MISMATCH", "INVALID_SLIP", "DUPLICATE", "ERROR"];
export const LOW_STOCK_THRESHOLD = 5;

export interface NotificationItem {
  key: string;
  label: string;
  count: number;
  /** หน้าปลายทางเมื่อกดที่รายการ */
  href: string;
  /** เมนูด้านข้างที่ควรแสดงป้ายตัวเลข (ไม่ใส่ = ไม่แสดงป้ายที่เมนู) */
  navHref?: string;
  /** warn = ต้องดูเป็นพิเศษ (สีเตือน) */
  tone: "normal" | "warn";
  /** นับรวมในตัวเลขบนกระดิ่งหรือไม่ (รายการที่เป็นส่วนย่อยของรายการอื่นไม่ต้องนับซ้ำ) */
  inBadge: boolean;
}

export async function getNotifications(role: AdminRole): Promise<NotificationItem[]> {
  const isSuper = role === "SUPER_ADMIN";
  const canReservations = isSuper || role === "FINANCE_STAFF" || role === "RESERVATION_STAFF";
  const canMerchOrders = isSuper || role === "MERCH_STAFF" || role === "FINANCE_STAFF" || role === "RESERVATION_STAFF";
  const canSupport = isSuper || role === "FINANCE_STAFF";
  const canShip = isSuper || role === "MERCH_STAFF";
  const canStock = isSuper || role === "MERCH_STAFF";

  // เจ้าหน้าที่จองโต๊ะไม่มีหน้า "รายการจอง" รวม — ดูรายการจองผ่านหน้า "งานเลี้ยง"
  const reservationsHref = role === "RESERVATION_STAFF" ? "/admin/events" : "/admin/reservations";

  const [awaitingReservations, suspiciousSlips, awaitingMerch, merchToShip, awaitingSupport, lowStock] = await Promise.all([
    canReservations ? prisma.reservation.count({ where: { paymentStatus: "awaiting_verify" } }) : 0,
    canReservations
      ? prisma.reservation.count({
          where: { paymentStatus: "awaiting_verify", slips: { some: { easyslipStatus: { in: SUSPICIOUS_SLIP } } } },
        })
      : 0,
    canMerchOrders ? prisma.merchOrder.count({ where: { paymentStatus: "awaiting_verify" } }) : 0,
    canShip ? prisma.merchOrder.count({ where: { paymentStatus: "confirmed", trackingNumber: null } }) : 0,
    canSupport ? prisma.supportRegistration.count({ where: { paymentStatus: "awaiting_verify" } }) : 0,
    canStock
      ? prisma.merchProductStock.count({ where: { quantity: { lte: LOW_STOCK_THRESHOLD }, product: { active: true } } })
      : 0,
  ]);

  const items: NotificationItem[] = [
    {
      key: "reservations",
      label: "การจองรอตรวจสลิป",
      count: awaitingReservations,
      href: reservationsHref,
      navHref: reservationsHref,
      tone: "normal",
      inBadge: true,
    },
    {
      key: "suspicious",
      label: "สลิปที่ระบบตรวจแล้วน่าสงสัย",
      count: suspiciousSlips,
      href: reservationsHref,
      tone: "warn",
      inBadge: false, // เป็นส่วนหนึ่งของ "การจองรอตรวจสลิป" อยู่แล้ว
    },
    {
      key: "merch",
      label: "ออเดอร์ของที่ระลึกรอตรวจสลิป",
      count: awaitingMerch,
      href: "/admin/merch/orders",
      navHref: "/admin/merch/orders",
      tone: "normal",
      inBadge: true,
    },
    {
      key: "toship",
      label: "ออเดอร์รอจัดส่ง (ยังไม่ใส่เลขพัสดุ)",
      count: merchToShip,
      href: "/admin/merch/orders?ship=toship",
      navHref: "/admin/merch/orders",
      tone: "normal",
      inBadge: true,
    },
    {
      key: "support",
      label: "ลงทะเบียนศิษย์เก่าดีเด่น/ผู้สนับสนุนรอตรวจสลิป",
      count: awaitingSupport,
      href: "/admin/support-registrations",
      navHref: "/admin/support-registrations",
      tone: "normal",
      inBadge: true,
    },
    {
      key: "lowstock",
      label: `สินค้าใกล้หมด (เหลือ ≤ ${LOW_STOCK_THRESHOLD} ชิ้น)`,
      count: lowStock,
      href: "/admin/merch/products",
      navHref: "/admin/merch/products",
      tone: "warn",
      inBadge: true,
    },
  ];

  return items.filter((i) => i.count > 0);
}
