import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiHelpers";

// route นี้อ่านฐานข้อมูล — ต้องไม่ถูก prerender ตอน docker build (ไม่มี DATABASE_URL)
export const dynamic = "force-dynamic";

/**
 * ค้นหารวมบนแถบบนของหน้า admin (GET /api/admin/search?q=...)
 *
 * ผลลัพธ์กรองตามบทบาท "เท่ากับสิทธิ์ที่บทบาทนั้นมีอยู่แล้ว" ในหน้า/API รายหน้า:
 *   - การจอง         : SUPER, FINANCE (หน้ารายการจอง), RESERVATION (ผ่านหน้างานเลี้ยง), CHECKIN (หน้าเช็คอิน)
 *   - ออเดอร์ของที่ระลึก : SUPER, MERCH, FINANCE, RESERVATION
 *   - ผู้สนับสนุน/ศิษย์เก่าดีเด่น : SUPER, FINANCE
 *   - ทำเนียบศิษย์เก่า   : SUPER
 * ไม่ได้ให้สิทธิ์ใหม่ — แค่ทางลัดไปยังหน้าเดิมพร้อม ?q= ให้หน้านั้นกรองต่อ
 */

const PER_GROUP = 5;

const STATUS_LABEL: Record<string, string> = {
  pending: "รอชำระเงิน",
  awaiting_verify: "รอตรวจสอบสลิป",
  confirmed: "ยืนยันแล้ว",
  rejected: "ปฏิเสธ",
  expired: "หมดเวลา",
};
const SUPPORT_TYPE_LABEL: Record<string, string> = {
  distinguished_alumni: "ศิษย์เก่าดีเด่น",
  sponsor: "ผู้สนับสนุนงาน",
};

interface SearchItem {
  id: string;
  title: string;
  subtitle: string;
  status?: string;
  href: string;
}
interface SearchGroup {
  key: string;
  label: string;
  /** ลิงก์ "ดูทั้งหมด" ไปหน้ารายการพร้อมคำค้น */
  href: string;
  items: SearchItem[];
  more: boolean;
}

function withQ(path: string, q: string) {
  return `${path}?q=${encodeURIComponent(q)}`;
}

export async function GET(req: NextRequest) {
  const { admin, response } = requireAdmin(req);
  if (response) return response;

  const role = admin!.role;
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ groups: [] });

  // เบอร์โทรที่พิมพ์มีขีด/เว้นวรรค (081-234-5678) ให้ค้นแบบตัวเลขล้วนด้วย
  const digits = q.replace(/[\s-]/g, "");
  const phoneTerms = Array.from(new Set([q, ...(/^\d{3,}$/.test(digits) ? [digits] : [])]));

  const isSuper = role === "SUPER_ADMIN";
  const canReservations = isSuper || role === "FINANCE_STAFF" || role === "RESERVATION_STAFF" || role === "CHECKIN_STAFF";
  const canMerch = isSuper || role === "MERCH_STAFF" || role === "FINANCE_STAFF" || role === "RESERVATION_STAFF";
  const canSupport = isSuper || role === "FINANCE_STAFF";
  const canAlumni = isSuper;

  const [reservations, orders, supports, alumni] = await Promise.all([
    canReservations
      ? prisma.reservation.findMany({
          where: {
            OR: [
              { bookingCode: { contains: q, mode: "insensitive" } },
              { bookerName: { contains: q, mode: "insensitive" } },
              ...phoneTerms.map((t) => ({ bookerPhone: { contains: t } })),
            ],
          },
          select: {
            id: true,
            bookingCode: true,
            bookerName: true,
            bookerPhone: true,
            paymentStatus: true,
            eventId: true,
            table: { select: { tableNumber: true } },
          },
          orderBy: { createdAt: "desc" },
          take: PER_GROUP + 1,
        })
      : [],
    canMerch
      ? prisma.merchOrder.findMany({
          where: {
            OR: [
              { orderCode: { contains: q, mode: "insensitive" } },
              { bookerName: { contains: q, mode: "insensitive" } },
              { trackingNumber: { contains: q, mode: "insensitive" } },
              ...phoneTerms.map((t) => ({ bookerPhone: { contains: t } })),
            ],
          },
          select: { id: true, orderCode: true, bookerName: true, bookerPhone: true, paymentStatus: true, trackingNumber: true },
          orderBy: { createdAt: "desc" },
          take: PER_GROUP + 1,
        })
      : [],
    canSupport
      ? prisma.supportRegistration.findMany({
          where: {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              ...phoneTerms.map((t) => ({ phone: { contains: t } })),
            ],
          },
          select: { id: true, code: true, name: true, phone: true, type: true, paymentStatus: true },
          orderBy: { createdAt: "desc" },
          take: PER_GROUP + 1,
        })
      : [],
    canAlumni
      ? prisma.alumni.findMany({
          where: {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { department: { contains: q, mode: "insensitive" } },
              ...phoneTerms.map((t) => ({ phone: { contains: t } })),
            ],
          },
          select: { id: true, fullName: true, graduationYear: true, department: true, phone: true },
          orderBy: { createdAt: "desc" },
          take: PER_GROUP + 1,
        })
      : [],
  ]);

  const groups: SearchGroup[] = [];

  if (reservations.length > 0) {
    // ปลายทางต่างกันตามบทบาท: การเงิน/ซุปเปอร์ → หน้ารวม, เจ้าหน้าที่จอง → หน้าการจองของงานนั้น, เช็คอิน → หน้าเช็คอิน
    const listHref = (eventId: string) =>
      role === "CHECKIN_STAFF"
        ? "/admin/checkin"
        : role === "RESERVATION_STAFF"
          ? `/admin/events/${eventId}/reservations`
          : "/admin/reservations";
    groups.push({
      key: "reservations",
      label: role === "CHECKIN_STAFF" ? "ผู้จอง (เช็คอิน)" : "การจองโต๊ะ",
      href: withQ(listHref(reservations[0].eventId), q),
      more: reservations.length > PER_GROUP,
      items: reservations.slice(0, PER_GROUP).map((r) => ({
        id: r.id,
        title: `${r.bookerName}`,
        subtitle: `${r.bookingCode} · โต๊ะ ${r.table.tableNumber} · ${r.bookerPhone}`,
        status: STATUS_LABEL[r.paymentStatus] || r.paymentStatus,
        href: withQ(listHref(r.eventId), r.bookingCode),
      })),
    });
  }

  if (orders.length > 0) {
    groups.push({
      key: "merch",
      label: "ออเดอร์ของที่ระลึก",
      href: withQ("/admin/merch/orders", q),
      more: orders.length > PER_GROUP,
      items: orders.slice(0, PER_GROUP).map((o) => ({
        id: o.id,
        title: o.bookerName,
        subtitle: `${o.orderCode} · ${o.bookerPhone}${o.trackingNumber ? ` · พัสดุ ${o.trackingNumber}` : ""}`,
        status: STATUS_LABEL[o.paymentStatus] || o.paymentStatus,
        href: withQ("/admin/merch/orders", o.orderCode),
      })),
    });
  }

  if (supports.length > 0) {
    groups.push({
      key: "support",
      label: "ศิษย์เก่าดีเด่น/ผู้สนับสนุน",
      href: withQ("/admin/support-registrations", q),
      more: supports.length > PER_GROUP,
      items: supports.slice(0, PER_GROUP).map((s) => ({
        id: s.id,
        title: s.name,
        subtitle: `${s.code} · ${SUPPORT_TYPE_LABEL[s.type] || s.type} · ${s.phone}`,
        status: STATUS_LABEL[s.paymentStatus] || s.paymentStatus,
        href: withQ("/admin/support-registrations", s.code),
      })),
    });
  }

  if (alumni.length > 0) {
    groups.push({
      key: "alumni",
      label: "ทำเนียบศิษย์เก่า",
      href: withQ("/admin/alumni", q),
      more: alumni.length > PER_GROUP,
      items: alumni.slice(0, PER_GROUP).map((a) => ({
        id: a.id,
        title: a.fullName,
        subtitle: [a.graduationYear && `รุ่น ${a.graduationYear}`, a.department, a.phone].filter(Boolean).join(" · ") || "-",
        href: withQ("/admin/alumni", a.fullName),
      })),
    });
  }

  return NextResponse.json({ groups });
}
