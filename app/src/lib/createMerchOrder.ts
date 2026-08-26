import { prisma } from "./prisma";
import crypto from "crypto";

export interface CreateMerchOrderItemInput {
  productId: string;
  size?: string;
  quantity: number;
}

export interface CreateMerchOrderInput {
  bookerName: string;
  bookerPhone: string;
  bookerEmail?: string;
  items: CreateMerchOrderItemInput[];
}

export class MerchOrderError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Same human-friendly code shape as Reservation.bookingCode
 * (see lib/qrcode.ts's generateBookingCode) — 8-char uppercase alphanumeric
 * with ambiguous characters removed.
 */
function generateOrderCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

/**
 * Creates a merch order atomically. Fully independent of table booking —
 * no event/table lock involved, just product lookups + a single insert.
 * Prices are always taken from the DB, never trusted from the client.
 */
export async function createMerchOrder(input: CreateMerchOrderInput) {
  const { bookerName, bookerPhone, bookerEmail, items } = input;

  if (!bookerName?.trim() || !bookerPhone?.trim()) {
    throw new MerchOrderError("MISSING_FIELDS", "กรุณากรอกชื่อและเบอร์โทรศัพท์");
  }
  if (!items || items.length === 0) {
    throw new MerchOrderError("EMPTY_CART", "กรุณาเลือกสินค้าอย่างน้อย 1 รายการ");
  }

  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.merchProduct.findMany({
    where: { id: { in: productIds }, active: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const orderItemsData: {
    productId: string;
    size: string | null;
    quantity: number;
    unitPrice: number;
  }[] = [];
  let totalAmount = 0;

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new MerchOrderError("PRODUCT_NOT_FOUND", "ไม่พบสินค้าที่เลือก หรือสินค้าถูกปิดการขายแล้ว");
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new MerchOrderError("INVALID_QUANTITY", "จำนวนสินค้าต้องมากกว่า 0");
    }
    if (product.requiresSize && !item.size?.trim()) {
      throw new MerchOrderError("SIZE_REQUIRED", `กรุณาเลือกไซส์สำหรับสินค้า "${product.name}"`);
    }

    const unitPrice = Number(product.price);
    totalAmount += unitPrice * item.quantity;

    orderItemsData.push({
      productId: product.id,
      size: product.requiresSize ? item.size!.trim() : null,
      quantity: item.quantity,
      unitPrice,
    });
  }

  let orderCode = generateOrderCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const exists = await prisma.merchOrder.findUnique({ where: { orderCode } });
    if (!exists) break;
    orderCode = generateOrderCode();
  }

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.merchOrder.create({
      data: {
        orderCode,
        bookerName: bookerName.trim(),
        bookerPhone: bookerPhone.trim(),
        bookerEmail: bookerEmail?.trim() || null,
        totalAmount,
        paymentStatus: "pending",
        items: { create: orderItemsData },
      },
      include: { items: true },
    });
    return created;
  });

  return order;
}