import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiHelpers";
import { presignedGetUrl, PAYMENT_SLIPS_BUCKET } from "@/lib/minio";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF", "FINANCE_STAFF", "RESERVATION_STAFF"]);
  if (response) return response;

  const orders = await prisma.merchOrder.findMany({
    include: {
      items: true,
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
        shippingAddress: o.shippingAddress,
        paymentStatus: o.paymentStatus,
        totalAmount: o.totalAmount,
        createdAt: o.createdAt,
        items: o.items.map((it) => ({
          productName: it.productName,
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
