import { prisma } from "./prisma";
import crypto from "crypto";
import { isValidEmailFormat, hasDeliverableEmailDomain } from "./validateEmail";
import { validateNamePart, validateThaiPhone, cleanPhoneForStorage } from "./formValidation";
import { getMerchShippingFee, getMerchPickupEnabled, MERCH_PICKUP_ADDRESS_TEXT } from "./settings";
import { type ThaiAddress, normalizeThaiAddress, validateThaiAddress, composeThaiAddress } from "./thaiAddress";
import { merchHoldUntil } from "./holdPolicy";
import { computeParcel, type ParcelLine } from "./parcel";

export interface CreateMerchOrderItemInput {
  productId: string;
  size?: string;
  quantity: number;
}

export interface CreateMerchOrderInput {
  bookerName: string;
  bookerPhone: string;
  bookerEmail: string;
  shippingAddress: string;
  /** รับสินค้าที่วิทยาลัย (ต้องเปิดไว้ในหน้าตั้งค่า admin) — ไม่ต้องมีที่อยู่ และค่าจัดส่ง = 0 */
  pickup?: boolean;
  /** ที่อยู่แบบแยกช่อง (ใช้เมื่อไม่ได้เลือกรับที่วิทยาลัย) — ถ้าไม่ส่งมาจะใช้ shippingAddress ข้อความเดิม */
  address?: ThaiAddress;
  items: CreateMerchOrderItemInput[];
  /** Object-storage key of an already-uploaded payment slip (see
   * lib/minio.ts's uploadObject) — attached in the same checkout step as
   * the order form itself (one page, one submit), so when present the
   * order is created directly in "awaiting_verify" status with its
   * MerchPaymentSlip row, in the same transaction. */
  slipFileKey?: string;
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
  const { bookerName, bookerPhone, bookerEmail, items, slipFileKey } = input;
  const pickup = !!input.pickup;
  if (pickup && !(await getMerchPickupEnabled())) {
    throw new MerchOrderError("PICKUP_DISABLED", "ขณะนี้ปิดรับสินค้าที่วิทยาลัย กรุณาเลือกจัดส่งทางไปรษณีย์");
  }
  let addr: ThaiAddress | null = null;
  let shippingAddress: string;
  if (pickup) {
    shippingAddress = MERCH_PICKUP_ADDRESS_TEXT;
  } else if (input.address) {
    addr = normalizeThaiAddress(input.address);
    const addrErrs = validateThaiAddress(addr);
    const firstErr = Object.values(addrErrs)[0];
    if (firstErr) throw new MerchOrderError("INVALID_ADDRESS", firstErr);
    shippingAddress = composeThaiAddress(addr);
  } else {
    shippingAddress = input.shippingAddress;
  }

  if (!bookerName?.trim() || !bookerPhone?.trim() || !bookerEmail?.trim()) {
    throw new MerchOrderError("MISSING_FIELDS", "กรุณากรอกชื่อ เบอร์โทรศัพท์ และอีเมล");
  }
  if (!shippingAddress?.trim()) {
    throw new MerchOrderError("MISSING_FIELDS", "กรุณากรอกที่อยู่สำหรับจัดส่ง");
  }
  if (!items || items.length === 0) {
    throw new MerchOrderError("EMPTY_CART", "กรุณาเลือกสินค้าอย่างน้อย 1 รายการ");
  }

  {
    const nameParts = bookerName.trim().split(/\s+/);
    const namePartLabel = nameParts.length > 1 ? "ชื่อ-นามสกุล" : "ชื่อ";
    const nameErr = validateNamePart(bookerName, namePartLabel);
    if (nameErr) {
      throw new MerchOrderError("INVALID_NAME", nameErr);
    }
  }
  {
    const phoneErr = validateThaiPhone(bookerPhone);
    if (phoneErr) {
      throw new MerchOrderError("INVALID_PHONE", phoneErr);
    }
  }

  const email = bookerEmail.trim();
  if (!isValidEmailFormat(email)) {
    throw new MerchOrderError("INVALID_EMAIL", "รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง");
  }
  // Same DNS-deliverability check used for table booking. Done outside the
  // DB transaction below since it's network I/O.
  const deliverable = await hasDeliverableEmailDomain(email);
  if (!deliverable) {
    throw new MerchOrderError(
      "UNDELIVERABLE_EMAIL",
      "ไม่สามารถส่งอีเมลไปยังโดเมนนี้ได้ กรุณาตรวจสอบอีเมลอีกครั้ง"
    );
  }

  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.merchProduct.findMany({
    where: { id: { in: productIds }, active: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const orderItemsData: {
    productId: string;
    productName: string;
    size: string | null;
    quantity: number;
    unitPrice: number;
  }[] = [];
  let totalAmount = 0;
  const parcelLines: ParcelLine[] = [];

  // Snapshotted onto the order below so a later change to the configured
  // fee never retroactively changes a past order's total.
  const shippingFee = pickup ? 0 : await getMerchShippingFee();

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
    parcelLines.push({
      quantity: item.quantity,
      weightGrams: product.weightGrams,
      lengthCm: product.lengthCm,
      widthCm: product.widthCm,
      heightCm: product.heightCm,
    });

    orderItemsData.push({
      productId: product.id,
      productName: product.name,
      size: product.requiresSize ? item.size!.trim() : null,
      quantity: item.quantity,
      unitPrice,
    });
  }

  totalAmount += shippingFee;

  // น้ำหนัก/ขนาดพัสดุรวม (snapshot) — เฉพาะออเดอร์จัดส่ง; รับที่วิทยาลัยไม่มีพัสดุ
  const parcel = pickup ? null : computeParcel(parcelLines);

  let orderCode = generateOrderCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const exists = await prisma.merchOrder.findUnique({ where: { orderCode } });
    if (!exists) break;
    orderCode = generateOrderCode();
  }

  const order = await prisma.$transaction(async (tx) => {
    // Decrement stock first, atomically and race-safely: the WHERE clause
    // re-checks quantity >= requested at the moment of the update, so two
    // concurrent orders competing for the last unit can't both succeed.
    // Each cart line is checked independently (in order), which is safe
    // even if the same product+size appears twice in one order — each
    // updateMany re-reads the just-decremented quantity.
    for (const item of orderItemsData) {
      const result = await tx.merchProductStock.updateMany({
        where: { productId: item.productId, size: item.size, quantity: { gte: item.quantity } },
        data: { quantity: { decrement: item.quantity } },
      });
      if (result.count === 0) {
        const product = productMap.get(item.productId)!;
        const label = item.size ? `${product.name} (ไซส์ ${item.size})` : product.name;
        throw new MerchOrderError("OUT_OF_STOCK", `สินค้า "${label}" มีไม่เพียงพอ กรุณาลดจำนวนหรือเลือกไซส์อื่น`);
      }
    }

    const created = await tx.merchOrder.create({
      data: {
        orderCode,
        bookerName: bookerName.trim(),
        bookerPhone: cleanPhoneForStorage(bookerPhone),
        bookerEmail: email,
        shippingAddress: shippingAddress.trim(),
        addrLine: addr?.line ?? null,
        addrSubdistrict: addr?.subdistrict ?? null,
        addrDistrict: addr?.district ?? null,
        addrProvince: addr?.province ?? null,
        addrPostcode: addr?.postcode ?? null,
        addrManual: addr?.manual ?? false,
        shippingFee,
        parcelWeightGrams: parcel?.weightGrams ?? null,
        parcelLengthCm: parcel?.lengthCm ?? null,
        parcelWidthCm: parcel?.widthCm ?? null,
        parcelHeightCm: parcel?.heightCm ?? null,
        parcelIncomplete: parcel?.incomplete ?? false,
        totalAmount,
        paymentStatus: slipFileKey ? "awaiting_verify" : "pending",
        reservedUntil: merchHoldUntil(slipFileKey ? "awaiting_verify" : "pending"),
        items: { create: orderItemsData },
      },
      include: { items: true },
    });

    if (slipFileKey) {
      await tx.merchPaymentSlip.create({
        data: { orderId: created.id, fileKey: slipFileKey },
      });
    }

    return created;
  });

  return order;
}
