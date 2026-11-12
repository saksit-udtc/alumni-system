import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { logAdminAction } from "@/lib/auditLog";
import { MERCH_PICKUP_ADDRESS_TEXT } from "@/lib/settings";

// อ่านฐานข้อมูลทุกครั้ง — ต้องไม่ถูก prerender ตอน docker build (ไม่มี DATABASE_URL)
export const dynamic = "force-dynamic";

const ROLES = ["SUPER_ADMIN", "MERCH_STAFF"] as const;

/**
 * รายการออเดอร์ที่ลูกค้าเลือก "รับสินค้าที่วิทยาลัย" และยืนยันสลิปชำระแล้ว
 *  ?status=waiting (ค่าเริ่มต้น) | done | all
 *  ?q=ข้อความค้นหา (รหัสออเดอร์ / ชื่อ / เบอร์โทร)
 * ส่งกลับ counts ของทั้งสองสถานะ (ไม่ขึ้นกับตัวกรอง q) และจำนวนออเดอร์รับที่วิทยาลัยที่ยังรอยืนยันสลิป
 */
export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req, [...ROLES]);
  if (response) return response;

  const status = req.nextUrl.searchParams.get("status") || "waiting";
  const q = (req.nextUrl.searchParams.get("q") || "").trim();

  const base = { shippingAddress: MERCH_PICKUP_ADDRESS_TEXT, paymentStatus: "confirmed" as const };

  const [waiting, done, unpaid, orders] = await Promise.all([
    prisma.merchOrder.count({ where: { ...base, pickedUpAt: null } }),
    prisma.merchOrder.count({ where: { ...base, pickedUpAt: { not: null } } }),
    prisma.merchOrder.count({
      where: { shippingAddress: MERCH_PICKUP_ADDRESS_TEXT, paymentStatus: { in: ["pending", "awaiting_verify"] } },
    }),
    prisma.merchOrder.findMany({
      where: {
        ...base,
        ...(status === "waiting" ? { pickedUpAt: null } : status === "done" ? { pickedUpAt: { not: null } } : {}),
        ...(q
          ? {
              OR: [
                { orderCode: { contains: q, mode: "insensitive" } },
                { bookerName: { contains: q, mode: "insensitive" } },
                { bookerPhone: { contains: q.replace(/[^0-9]/g, "") || q } },
              ],
            }
          : {}),
      },
      include: { items: true },
      orderBy: status === "done" ? { pickedUpAt: "desc" } : { createdAt: "asc" },
      take: 300,
    }),
  ]);

  return NextResponse.json({
    counts: { waiting, done, unpaid },
    orders: orders.map((o) => ({
      id: o.id,
      orderCode: o.orderCode,
      bookerName: o.bookerName,
      bookerPhone: o.bookerPhone,
      totalAmount: Number(o.totalAmount),
      createdAt: o.createdAt,
      pickedUpAt: o.pickedUpAt,
      pickedUpBy: o.pickedUpBy,
      items: o.items.map((it) => ({ productName: it.productName, size: it.size, quantity: it.quantity })),
    })),
  });
}

/**
 * ยืนยันว่าลูกค้ามารับสินค้าแล้ว / ยกเลิกการยืนยัน
 * Body: { id: string, done: boolean }
 */
export async function POST(req: NextRequest) {
  const { admin, response } = requireAdmin(req, [...ROLES]);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const done = body?.done !== false;
  if (!id) return jsonError("ไม่พบรหัสออเดอร์", 400);

  const order = await prisma.merchOrder.findUnique({
    where: { id },
    select: { id: true, orderCode: true, shippingAddress: true, paymentStatus: true, pickedUpAt: true },
  });
  if (!order) return jsonError("ไม่พบคำสั่งซื้อ", 404);
  if (order.shippingAddress !== MERCH_PICKUP_ADDRESS_TEXT) return jsonError("ออเดอร์นี้เป็นแบบจัดส่ง ไม่ใช่รับที่วิทยาลัย", 400);
  if (order.paymentStatus !== "confirmed") return jsonError("ออเดอร์นี้ยังไม่ผ่านการยืนยันการชำระเงิน", 400);

  if (done && order.pickedUpAt) return jsonError("ออเดอร์นี้ถูกยืนยันว่ารับสินค้าแล้ว (อาจมีเจ้าหน้าที่คนอื่นกดไปก่อน)", 409);
  if (!done && !order.pickedUpAt) return jsonError("ออเดอร์นี้ยังไม่ได้ถูกยืนยันว่ารับสินค้า", 409);

  const who = await prisma.adminUser.findUnique({ where: { id: admin!.adminId }, select: { username: true } });

  // เงื่อนไขใน where ป้องกันสองคนกดพร้อมกัน — คนที่สองจะไม่ได้ผลลัพธ์ (count = 0)
  const r = await prisma.merchOrder.updateMany({
    where: { id, pickedUpAt: done ? null : { not: null } },
    data: done ? { pickedUpAt: new Date(), pickedUpBy: who?.username ?? null } : { pickedUpAt: null, pickedUpBy: null },
  });
  if (r.count === 0) return jsonError("สถานะออเดอร์เพิ่งถูกเปลี่ยนโดยผู้อื่น กรุณารีเฟรช", 409);

  await logAdminAction({
    adminId: admin!.adminId,
    action: done ? "MERCH_ORDER_PICKED_UP" : "MERCH_ORDER_PICKUP_UNDO",
    targetType: "MerchOrder",
    targetId: id,
    detail: order.orderCode,
  });

  return NextResponse.json({ ok: true });
}
