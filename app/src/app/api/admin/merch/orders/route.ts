import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiHelpers";
import { presignedGetUrl, PAYMENT_SLIPS_BUCKET } from "@/lib/minio";

export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req);
  if (response) return response;

  const orders = await prisma.merchOrder.findMany({
    include: {
      items: { include: { product: { select: { name: true } } } },
      slips: { orderBy: { uploadedAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  const withSlipUrls = await Promise.all(
    orders.map(async (o) => {
      const latestSlip = o.slips[0];
      const slipUrl = latestSlip ? await presignedGetUrl(PAYMENT_SLIPS_BUCKET, latestSlip.fileKey) : null;
      return {
        id: o.id,
        orderCode: o.orderCode,
        bookerName: o.bookerName,
        bookerPhone: o.bookerPhone,
        bookerEmail: o.bookerEmail,
        paymentStatus: o.paymentStatus,
        totalAmount: o.totalAmount,
        createdAt: o.createdAt,
        items: o.items.map((it) => ({
          productName: it.product.name,
          size: it.size,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
        latestSlipUrl: slipUrl,
        latestSlipNote: latestSlip?.note || null,
      };
    })
  );

  return NextResponse.json({ orders: withSlipUrls });
}
