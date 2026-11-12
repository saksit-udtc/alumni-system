import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiHelpers";
import { getSenderAddress, MERCH_PICKUP_ADDRESS_TEXT } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * คิวงานจัดส่งสำหรับหน้าปริ้นที่อยู่ / กรอกเลขพัสดุ
 *  - ไม่ส่ง ids  -> ทุกคำสั่งซื้อที่ยืนยันชำระแล้ว, เป็นแบบจัดส่ง (ไม่ใช่รับที่วิทยาลัย) และยังไม่มีเลขพัสดุ
 *  - ส่ง ids=a,b,c -> เฉพาะออเดอร์เหล่านั้น (ใช้ตอนพิมพ์; รวมที่มีเลขพัสดุแล้วเผื่อพิมพ์ซ้ำ)
 */
export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF", "RESERVATION_STAFF"]);
  if (response) return response;

  const idsParam = req.nextUrl.searchParams.get("ids");
  const ids = idsParam
    ? idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 500)
    : null;

  const orders = await prisma.merchOrder.findMany({
    where: {
      paymentStatus: "confirmed",
      shippingAddress: { not: MERCH_PICKUP_ADDRESS_TEXT },
      ...(ids ? { id: { in: ids } } : { trackingNumber: null }),
    },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  const sender = await getSenderAddress();

  return NextResponse.json({
    sender,
    orders: orders.map((o) => ({
      id: o.id,
      orderCode: o.orderCode,
      bookerName: o.bookerName,
      bookerPhone: o.bookerPhone,
      shippingAddress: o.shippingAddress,
      addrManual: o.addrManual,
      parcelIncomplete: o.parcelIncomplete,
      parcelWeightGrams: o.parcelWeightGrams,
      trackingNumber: o.trackingNumber,
      carrier: o.carrier,
      labelPrintedAt: o.labelPrintedAt,
      packedAt: o.packedAt,
      createdAt: o.createdAt,
      items: o.items.map((it) => ({
        productName: it.productName,
        size: it.size,
        quantity: it.quantity,
      })),
    })),
  });
}
