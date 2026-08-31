import { prisma } from "./prisma";

// Small generic key-value settings store (see prisma/schema.prisma's
// AppSetting model). Each setting gets a typed getter/setter pair here
// rather than exposing the raw key-value table to callers.

const MERCH_SHIPPING_FEE_KEY = "merchShippingFee";

/** Falls back to this if no row exists yet (fresh install / before an
 * admin has ever changed it) — matches the value requested when this
 * setting was introduced. */
export const DEFAULT_MERCH_SHIPPING_FEE = 50;

export async function getMerchShippingFee(): Promise<number> {
  const row = await prisma.appSetting.findUnique({ where: { key: MERCH_SHIPPING_FEE_KEY } });
  if (!row) return DEFAULT_MERCH_SHIPPING_FEE;
  const n = Number(row.value);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MERCH_SHIPPING_FEE;
}

export async function setMerchShippingFee(fee: number): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: MERCH_SHIPPING_FEE_KEY },
    update: { value: String(fee) },
    create: { key: MERCH_SHIPPING_FEE_KEY, value: String(fee) },
  });
}
