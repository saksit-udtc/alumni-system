import { prisma } from "./prisma";
import crypto from "crypto";

export interface CreatePosSaleItemInput {
  barcode: string;
  quantity: number;
}

export interface CreatePosSaleInput {
  cashierId: string;
  paymentMethod: "cash" | "transfer";
  buyerName?: string;
  buyerPhone?: string;
  items: CreatePosSaleItemInput[];
}

export class PosSaleError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Same human-friendly code shape as MerchOrder.orderCode / Reservation.
 * bookingCode — 8-char uppercase alphanumeric with ambiguous characters
 * removed.
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
 * Creates an in-person POS sale atomically: resolves each scanned barcode
 * to a MerchProductStock row, decrements stock race-safely (same
 * updateMany-with-quantity-guard pattern as lib/createMerchOrder.ts), and
 * records the sale as immediately confirmed. Unlike an online MerchOrder,
 * there is no slip upload or awaiting_verify status — payment (cash or
 * transfer) is already settled at the counter by the time this is called,
 * so the sale and the stock decrement just need to happen together.
 */
export async function createPosSale(input: CreatePosSaleInput) {
  const { cashierId, paymentMethod, buyerName, buyerPhone, items } = input;

  if (paymentMethod !== "cash" && paymentMethod !== "transfer") {
    throw new PosSaleError("INVALID_PAYMENT_METHOD", "กรุณาเลือกวิธีชำระเงิน");
  }
  if (!items || items.length === 0) {
    throw new PosSaleError("EMPTY_CART", "กรุณาสแกนสินค้าอย่างน้อย 1 รายการ");
  }

  // Merge repeated scans of the same barcode into one line, so the stock
  // check below only needs to look at each barcode once.
  const merged = new Map<string, number>();
  for (const item of items) {
    const barcode = item.barcode?.trim();
    if (!barcode) continue;
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new PosSaleError("INVALID_QUANTITY", "จำนวนสินค้าต้องมากกว่า 0");
    }
    merged.set(barcode, (merged.get(barcode) || 0) + item.quantity);
  }
  if (merged.size === 0) {
    throw new PosSaleError("EMPTY_CART", "กรุณาสแกนสินค้าอย่างน้อย 1 รายการ");
  }

  const stocks = await prisma.merchProductStock.findMany({
    where: { barcode: { in: [...merged.keys()] } },
    include: { product: true },
  });
  const stockByBarcode = new Map(stocks.map((s) => [s.barcode as string, s]));

  const saleItemsData: {
    productId: string | null;
    productName: string;
    size: string | null;
    barcode: string;
    quantity: number;
    unitPrice: number;
  }[] = [];
  let totalAmount = 0;

  for (const [barcode, quantity] of merged) {
    const stock = stockByBarcode.get(barcode);
    if (!stock || !stock.product || !stock.product.active) {
      throw new PosSaleError("BARCODE_NOT_FOUND", `ไม่พบสินค้าสำหรับบาร์โค้ด "${barcode}"`);
    }
    const unitPrice = Number(stock.product.price);
    totalAmount += unitPrice * quantity;
    saleItemsData.push({
      productId: stock.productId,
      productName: stock.product.name,
      size: stock.size,
      barcode,
      quantity,
      unitPrice,
    });
  }

  let saleCode = generateSaleCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const exists = await prisma.posSale.findUnique({ where: { saleCode } });
    if (!exists) break;
    saleCode = generateSaleCode();
  }

  const sale = await prisma.$transaction(async (tx) => {
    // Decrement stock first, atomically and race-safely — the WHERE
    // clause re-checks quantity >= requested at the moment of the update,
    // so two concurrent POS sales (or a POS sale racing an online order)
    // competing for the last unit can't both succeed.
    for (const [barcode, quantity] of merged) {
      const stock = stockByBarcode.get(barcode)!;
      const result = await tx.merchProductStock.updateMany({
        where: { id: stock.id, quantity: { gte: quantity } },
        data: { quantity: { decrement: quantity } },
      });
      if (result.count === 0) {
        const label = stock.size ? `${stock.product!.name} (ไซส์ ${stock.size})` : stock.product!.name;
        throw new PosSaleError("OUT_OF_STOCK", `สินค้า "${label}" มีไม่เพียงพอ`);
      }
    }

    return tx.posSale.create({
      data: {
        saleCode,
        cashierId,
        paymentMethod,
        buyerName: buyerName?.trim() || null,
        buyerPhone: buyerPhone?.trim() || null,
        totalAmount,
        items: { create: saleItemsData },
      },
      include: { items: true, cashier: { select: { username: true } } },
    });
  });

  return sale;
}
