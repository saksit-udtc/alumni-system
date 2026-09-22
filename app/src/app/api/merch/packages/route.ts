import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMerchShippingFee } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Public: list active merch-only packages (bookingType null — "เฉพาะของที่
// ระลึก", no table involved) for the merch shop page. Sold online only —
// see lib/createMerchPackageOrder.ts and /merch/package/[id].
export async function GET() {
  const [packages, shippingFee] = await Promise.all([
    prisma.package.findMany({
      where: { active: true, bookingType: null },
      orderBy: { createdAt: "asc" },
      include: {
        items: {
          include: {
            product: { select: { name: true, stocks: { select: { size: true, quantity: true } } } },
          },
        },
      },
    }),
    getMerchShippingFee(),
  ]);

  return NextResponse.json({
    shippingFee,
    packages: packages.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      items: p.items.map((it) => ({
        packageItemId: it.id,
        productName: it.product.name,
        size: it.size,
        quantity: it.quantity,
        buyerChoosesSize: it.buyerChoosesSize,
        availableSizes: it.buyerChoosesSize
          ? it.product.stocks.filter((s) => s.quantity > 0).map((s) => s.size || "")
          : [],
      })),
    })),
  });
}
