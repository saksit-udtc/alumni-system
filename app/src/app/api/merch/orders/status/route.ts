import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Public status lookup. Requires bookerPhone (or orderCode + bookerPhone
 * pair) — never trusts a bare orderCode/id alone.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderCode = searchParams.get("orderCode")?.trim().toUpperCase();
  const phone = searchParams.get("phone")?.trim();

  if (!phone) {
    return NextResponse.json({ error: "กรุณาระบุเบอร์โทรศัพท์" }, { status: 400 });
  }

  const where = orderCode
    ? { orderCode, bookerPhone: phone }
    : { bookerPhone: phone };

  const orders = await prisma.merchOrder.findMany({
    where,
    include: {
      items: { include: { product: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (orderCode && orders.length === 0) {
    return NextResponse.json({ error: "ไม่พบข้อมูลการสั่งซื้อ" }, { status: 404 });
  }

  return NextResponse.json({
    orders: orders.map((o) => ({
      orderCode: o.orderCode,
      paymentStatus: o.paymentStatus,
      totalAmount: o.totalAmount,
      createdAt: o.createdAt,
      items: o.items.map((it) => ({
        productName: it.product.name,
        size: it.size,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
    })),
  });
}