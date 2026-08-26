import { NextRequest, NextResponse } from "next/server";
import { createMerchOrder, MerchOrderError } from "@/lib/createMerchOrder";
import { sendMerchOrderReceivedEmail } from "@/lib/mailer";

// Public: create a merch order. Fully independent of table booking.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const { bookerName, bookerPhone, bookerEmail, shippingAddress, items } = body;

  if (
    !bookerName ||
    !bookerPhone ||
    !bookerEmail ||
    !shippingAddress ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" }, { status: 400 });
  }

  try {
    const order = await createMerchOrder({
      bookerName,
      bookerPhone,
      bookerEmail,
      shippingAddress,
      items: items.map((i: any) => ({
        productId: i.productId,
        size: i.size,
        quantity: Number(i.quantity),
      })),
    });

    await sendMerchOrderReceivedEmail({
      to: order.bookerEmail,
      bookerName: order.bookerName,
      bookerPhone: order.bookerPhone,
      orderCode: order.orderCode,
      shippingAddress: order.shippingAddress,
      totalAmount: Number(order.totalAmount),
      items: order.items.map((it) => ({
        productName: it.productName,
        size: it.size,
        quantity: it.quantity,
      })),
    });

    return NextResponse.json({
      ok: true,
      orderCode: order.orderCode,
      orderId: order.id,
      totalAmount: order.totalAmount,
    });
  } catch (err) {
    if (err instanceof MerchOrderError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    console.error("[POST /api/merch/orders]", err);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการสั่งซื้อ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
