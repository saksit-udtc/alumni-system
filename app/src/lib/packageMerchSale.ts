import { prisma } from "./prisma";
import crypto from "crypto";
import { PosPaymentMethod } from "@prisma/client";

export interface SellMerchPackageInput {
  packageId: string;
  cashierId: string;
  paymentMethod: PosPaymentMethod;
  buyerName?: string;
  buyerPhone?: string;
  /** Buyer-chosen sizes for items with buyerChoosesSize:true — keyed by PackageItem.id. */
  itemSizeSelections?: Record<string, string>;
}

export class PackageMerchSaleError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Same human-friendly code shape as PosSale.saleCode elsewhere — duplicated
 * here rather than imported from lib/posSale.ts since that module's
 * generateSaleCode isn't exported (kept private there); if this drifts,
 * keep both in sync.
 */
function generateSaleCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

/**
 * Sells a merch-only Package (bookingType null — "เฉพาะของที่ระลึก", no
 * table involved) at the POS counter. A parallel, deliberately separate
 * path from bookPackage.ts (which always creates a Reservation and always
 * needs a table): this one creates a PosSale + PosSaleItem rows instead,
 * tagged with packageId, reusing the same race-safe stock-decrement
 * pattern as lib/posSale.ts/lib/bookPackage.ts. Never touches Table or
 * Reservation at all — a merch-only package purchase carries no check-in
 * QR and no event-day ticket, it's just a bundled retail sale.
 */
export async function sellMerchPackage(input: SellMerchPackageInput) {
  const { packageId, cashierId, paymentMethod, buyerName, buyerPhone, itemSizeSelections } = input;

  if (paymentMethod !== "cash" && paymentMethod !== "transfer") {
    throw new PackageMerchSaleError("INVALID_PAYMENT_METHOD", "กรุณาเลือกวิธีชำระเงิน");
  }

  return prisma.$transaction(
    async (tx) => {
      const pkg = await tx.package.findUnique({ where: { id: packageId }, include: { items: true } });
      if (!pkg) {
        throw new PackageMerchSaleError("PACKAGE_NOT_FOUND", "ไม่พบแพ็กเกจที่ระบุ");
      }
      if (!pkg.active) {
        throw new PackageMerchSaleError("PACKAGE_INACTIVE", "แพ็กเกจนี้ถูกปิดการขายแล้ว");
      }
      if (pkg.bookingType !== null) {
        throw new PackageMerchSaleError(
          "NOT_MERCH_ONLY",
          "แพ็กเกจนี้มีการจองโต๊ะรวมอยู่ด้วย กรุณาขายผ่านหน้า \"ขายแพ็กเกจหน้างาน\" แทน"
        );
      }

      const itemSnapshots: Array<{
        productId: string;
        productName: string;
        size: string | null;
        quantity: number;
        unitPrice: number;
      }> = [];

      for (const item of pkg.items) {
        let size = item.size;
        if (item.buyerChoosesSize) {
          const selected = itemSizeSelections?.[item.id]?.trim();
          if (!selected) {
            const product = await tx.merchProduct.findUnique({ where: { id: item.productId } });
            throw new PackageMerchSaleError(
              "SIZE_REQUIRED",
              `กรุณาเลือกไซส์สำหรับ "${product?.name ?? "สินค้า"}" ในแพ็กเกจ`
            );
          }
          size = selected;
        }

        const result = await tx.merchProductStock.updateMany({
          where: { productId: item.productId, size, quantity: { gte: item.quantity } },
          data: { quantity: { decrement: item.quantity } },
        });
        const product = await tx.merchProduct.findUnique({ where: { id: item.productId } });
        if (result.count === 0) {
          const label = size ? `${product?.name ?? "สินค้า"} (ไซส์ ${size})` : product?.name ?? "สินค้า";
          throw new PackageMerchSaleError("ITEM_OUT_OF_STOCK", `สินค้าในแพ็กเกจ "${label}" มีไม่เพียงพอ`);
        }
        itemSnapshots.push({
          productId: item.productId,
          productName: product?.name ?? "สินค้า",
          size,
          quantity: item.quantity,
          // Informational only — the real price charged is pkg.price on
          // the PosSale row below, not the sum of these lines (a bundle
          // discount means they don't have to add up, same idea as
          // ReservationPackageItem for the table+merch path).
          unitPrice: product ? Number(product.price) : 0,
        });
      }

      let saleCode = generateSaleCode();
      for (let attempt = 0; attempt < 5; attempt++) {
        const exists = await tx.posSale.findUnique({ where: { saleCode } });
        if (!exists) break;
        saleCode = generateSaleCode();
      }

      const sale = await tx.posSale.create({
        data: {
          saleCode,
          cashierId,
          paymentMethod,
          buyerName: buyerName?.trim() || null,
          buyerPhone: buyerPhone?.trim() || null,
          totalAmount: pkg.price,
          packageId: pkg.id,
          items: {
            create: itemSnapshots.map((snap) => ({
              productId: snap.productId,
              productName: snap.productName,
              size: snap.size,
              barcode: null,
              quantity: snap.quantity,
              unitPrice: snap.unitPrice,
            })),
          },
        },
        include: { items: true, cashier: { select: { username: true } }, package: { select: { name: true } } },
      });

      return sale;
    },
    { maxWait: 10_000, timeout: 15_000 }
  );
}
