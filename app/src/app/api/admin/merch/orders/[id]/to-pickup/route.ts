import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { logAdminAction } from "@/lib/auditLog";
import { MERCH_PICKUP_ADDRESS_TEXT } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * ลูกค้าสั่งแบบ "จัดส่ง" แต่เปลี่ยนใจมา "รับที่วิทยาลัย"
 *  - ใช้ได้เฉพาะออเดอร์ที่ยืนยันชำระแล้ว และยังไม่มีเลขพัสดุ/ยังไม่ส่ง
 *  - เปลี่ยนที่อยู่เป็นค่ารับที่วิทยาลัย (ออเดอร์จึงไปอยู่ในเมนู "รับสินค้าที่วิทยาลัย" และหลุดจากคิวปริ้น/กรอกเลขพัสดุเอง)
 *  - เปลี่ยนเฉพาะวิธีรับ: ไม่แตะ shippingFee/totalAmount (ไม่คืนค่าจัดส่ง) ยอดเงินคงเดิมตามที่ลูกค้าโอนมา
 *  - ล้างสถานะปริ้น/แพ็ค และข้อมูลพัสดุ; เก็บที่อยู่เดิมไว้ใน audit log
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN"]);
  if (response) return response;

  const order = await prisma.merchOrder.findUnique({ where: { id: params.id } });
  if (!order) return jsonError("ไม่พบการสั่งซื้อที่ระบุ", 404);
  if (order.shippingAddress === MERCH_PICKUP_ADDRESS_TEXT) {
    return jsonError("ออเดอร์นี้เป็นรับที่วิทยาลัยอยู่แล้ว", 409);
  }
  if (order.paymentStatus !== "confirmed") {
    return jsonError("เปลี่ยนได้เฉพาะคำสั่งซื้อที่ยืนยันการชำระเงินแล้ว (ตรวจสลิปก่อน)", 409);
  }
  if (order.trackingNumber || order.shippedAt) {
    return jsonError("ออเดอร์นี้มีเลขพัสดุ/ส่งออกไปแล้ว เปลี่ยนเป็นรับที่วิทยาลัยไม่ได้", 409);
  }

  // เงื่อนไขซ้ำใน where กันกดซ้อน/ถูกบันทึกเลขพัสดุระหว่างนี้
  const r = await prisma.merchOrder.updateMany({
    where: {
      id: order.id,
      paymentStatus: "confirmed",
      trackingNumber: null,
      shippedAt: null,
      NOT: { shippingAddress: MERCH_PICKUP_ADDRESS_TEXT },
    },
    data: {
      shippingAddress: MERCH_PICKUP_ADDRESS_TEXT,
      addrLine: null,
      addrSubdistrict: null,
      addrDistrict: null,
      addrProvince: null,
      addrPostcode: null,
      addrManual: false,
      parcelWeightGrams: null,
      parcelLengthCm: null,
      parcelWidthCm: null,
      parcelHeightCm: null,
      parcelIncomplete: false,
      labelPrintedAt: null,
      packedAt: null,
    },
  });
  if (r.count !== 1) return jsonError("สถานะออเดอร์เปลี่ยนไประหว่างทำรายการ กรุณารีเฟรชแล้วลองใหม่", 409);

  await logAdminAction({
    adminId: admin!.adminId,
    action: "MERCH_ORDER_TO_PICKUP",
    targetType: "MerchOrder",
    targetId: order.id,
    detail:
      `orderCode=${order.orderCode} เปลี่ยนจากจัดส่งเป็นรับที่วิทยาลัย (ไม่คืนค่าส่ง ยอดรวมคงเดิม ${Number(order.totalAmount)}) · ` +
      `โทร ${order.bookerPhone} · ที่อยู่เดิม: ${order.shippingAddress.replace(/\s+/g, " ").slice(0, 300)}`,
  });

  return NextResponse.json({ ok: true, orderCode: order.orderCode });
}
