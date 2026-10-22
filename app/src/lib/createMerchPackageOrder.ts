import { prisma } from "./prisma";
import crypto from "crypto";
import { isValidEmailFormat, hasDeliverableEmailDomain } from "./validateEmail";
import { validateNamePart, validateThaiPhone, cleanPhoneForStorage } from "./formValidation";
import { getMerchShippingFee, getMerchPickupEnabled, MERCH_PICKUP_ADDRESS_TEXT } from "./settings";
import { type ThaiAddress, normalizeThaiAddress, validateThaiAddress, composeThaiAddress } from "./thaiAddress";
import { merchHoldUntil } from "./holdPolicy";
import { computeParcel, type ParcelLine } from "./parcel";

export interface CreateMerchPackageOrderInput {
  packageId: string;
  bookerName: string;
  bookerPhone: string;
  bookerEmail: string;
  shippingAddress: string;
  /** รับสินค้าที่วิทยาลัย (ต้องเปิดไว้ในหน้าตั้งค่า admin) */
  pickup?: boolean;
  /** ที่อยู่แบบแยกช่อง (ใช้เมื่อไม่ได้เลือกรับที่วิทยาลัย) — ถ้าไม่ส่งมาจะใช้ shippingAddress ข้อความเดิม */
  address?: ThaiAddress;
  /** Buyer-chosen sizes for the package's PackageItem rows that have
   * buyerChoosesSize:true — keyed by PackageItem.id. */
  itemSizeSelections?: Record<string, string>;
  /** Object-storage key of an already-uploaded payment slip — same
   * one-page-checkout pattern as lib/createMerchOrder.ts. */
  slipFileKey?: string;
}

export class MerchPackageOrderError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Same shape as lib/createMerchOrder.ts's generateOrderCode. */
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
 * Creates an online order for a merch-only Package (bookingType null —
 * "เฉพาะของที่ระลึก", no table at all). A parallel, deliberately separate
 * path from bookPackage.ts (which always creates a Reservation and always
 * needs a table): this one creates a MerchOrder + MerchOrderItem rows
 * instead, tagged with packageId, mirroring lib/createMerchOrder.ts's
 * shape (shipping address + fee, slip-upload-then-awaiting_verify) but
 * charging the package's fixed bundle price instead of summing per-item
 * prices. Never touches Table or Reservation at all.
 */
export async function createMerchPackageOrder(input: CreateMerchPackageOrderInput) {
  const { packageId, bookerName, bookerPhone, bookerEmail, itemSizeSelections, slipFileKey } = input;
  const pickup = !!input.pickup;
  if (pickup && !(await getMerchPickupEnabled())) {
    throw new MerchPackageOrderError("PICKUP_DISABLED", "ขณะนี้ปิดรับสินค้าที่วิทยาลัย กรุณาเลือกจัดส่งทางไปรษณีย์");
  }
  let addr: ThaiAddress | null = null;
  let shippingAddress: string;
  if (pickup) {
    shippingAddress = MERCH_PICKUP_ADDRESS_TEXT;
  } else if (input.address) {
    addr = normalizeThaiAddress(input.address);
    const addrErrs = validateThaiAddress(addr);
    const firstErr = Object.values(addrErrs)[0];
    if (firstErr) throw new MerchPackageOrderError("INVALID_ADDRESS", firstErr);
    shippingAddress = composeThaiAddress(addr);
  } else {
    shippingAddress = input.shippingAddress;
  }

  if (!bookerName?.trim() || !bookerPhone?.trim() || !bookerEmail?.trim()) {
    throw new MerchPackageOrderError("MISSING_FIELDS", "กรุณากรอกชื่อ เบอร์โทรศัพท์ และอีเมล");
  }
  if (!shippingAddress?.trim()) {
    throw new MerchPackageOrderError("MISSING_FIELDS", "กรุณากรอกที่อยู่สำหรับจัดส่ง");
  }
  {
    const nameParts = bookerName.trim().split(/\s+/);
    const namePartLabel = nameParts.length > 1 ? "ชื่อ-นามสกุล" : "ชื่อ";
    const nameErr = validateNamePart(bookerName, namePartLabel);
    if (nameErr) throw new MerchPackageOrderError("INVALID_NAME", nameErr);
  }
  {
    const phoneErr = validateThaiPhone(bookerPhone);
    if (phoneErr) throw new MerchPackageOrderError("INVALID_PHONE", phoneErr);
  }
  const email = bookerEmail.trim();
  if (!isValidEmailFormat(email)) {
    throw new MerchPackageOrderError("INVALID_EMAIL", "รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง");
  }
  const deliverable = await hasDeliverableEmailDomain(email);
  if (!deliverable) {
    throw new MerchPackageOrderError(
      "UNDELIVERABLE_EMAIL",
      "ไม่สามารถส่งอีเมลไปยังโดเมลนนี้ได้ กรุณาตรวจสอบอีเมลอีกครั้ง"
    );
  }

  const pkg = await prisma.package.findUnique({ where: { id: packageId }, include: { items: true } });
  if (!pkg) throw new MerchPackageOrderError("PACKAGE_NOT_FOUND", "ไม่พบแพ็กเกจที่ระบุ");
  if (!pkg.active) throw new MerchPackageOrderError("PACKAGE_INACTIVE", "แพ็กเกจนี้ถูกปิดการขายแล้ว");
  if (pkg.bookingType !== null) {
    throw new MerchPackageOrderError(
      "NOT_MERCH_ONLY",
      "แพ็กเกจนี้มีการจองโต๊ะรวมอยู่ด้วย กรุณาจองผ่านหน้าจองโต๊ะแทน"
    );
  }

  // Snapshotted onto the order below so a later change to the configured
  // fee never retroactively changes a past order's total — same pattern
  // as lib/createMerchOrder.ts.
  const shippingFee = pickup ? 0 : await getMerchShippingFee();
  const totalAmount = Number(pkg.price) + shippingFee;

  let orderCode = generateOrderCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const exists = await prisma.merchOrder.findUnique({ where: { orderCode } });
    if (!exists) break;
    orderCode = generateOrderCode();
  }

  const order = await prisma.$transaction(
    async (tx) => {
      const parcelLines: ParcelLine[] = [];
      const itemsData: {
        productId: string;
        productName: string;
        size: string | null;
        quantity: number;
        unitPrice: number;
      }[] = [];

      for (const item of pkg.items) {
        let size = item.size;
        if (item.buyerChoosesSize) {
          const selected = itemSizeSelections?.[item.id]?.trim();
          if (!selected) {
            const product = await tx.merchProduct.findUnique({ where: { id: item.productId } });
            throw new MerchPackageOrderError(
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
          throw new MerchPackageOrderError("ITEM_OUT_OF_STOCK", `สินค้าในแพ็กเกจ "${label}" มีไม่เพียงพอ`);
        }
        parcelLines.push({
          quantity: item.quantity,
          weightGrams: product?.weightGrams,
          lengthCm: product?.lengthCm,
          widthCm: product?.widthCm,
          heightCm: product?.heightCm,
        });
        itemsData.push({
          productId: item.productId,
          productName: product?.name ?? "สินค้า",
          size,
          quantity: item.quantity,
          // Informational only — the real price charged is totalAmount
          // above (pkg.price + shippingFee), not the sum of these lines,
          // same idea as ReservationPackageItem for the table+merch path.
          unitPrice: product ? Number(product.price) : 0,
        });
      }

      const parcel = pickup ? null : computeParcel(parcelLines);

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
          packageId: pkg.id,
          items: { create: itemsData },
        },
        include: { items: true },
      });

      if (slipFileKey) {
        await tx.merchPaymentSlip.create({
          data: { orderId: created.id, fileKey: slipFileKey },
        });
      }

      return created;
    },
    { maxWait: 10_000, timeout: 15_000 }
  );

  return order;
}
