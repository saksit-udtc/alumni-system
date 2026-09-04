import { prisma } from "./prisma";
import { LandingContent, DEFAULT_LANDING_CONTENT, sanitizeLandingContent } from "./landingContent";

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

const HOME_BANNER_INTERVAL_KEY = "homeBannerIntervalSeconds";

/** Autoplay interval for the homepage promo slider, in seconds. */
export const DEFAULT_HOME_BANNER_INTERVAL_SECONDS = 5;

export async function getHomeBannerIntervalSeconds(): Promise<number> {
  const row = await prisma.appSetting.findUnique({ where: { key: HOME_BANNER_INTERVAL_KEY } });
  if (!row) return DEFAULT_HOME_BANNER_INTERVAL_SECONDS;
  const n = Number(row.value);
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_HOME_BANNER_INTERVAL_SECONDS;
}

export async function setHomeBannerIntervalSeconds(seconds: number): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: HOME_BANNER_INTERVAL_KEY },
    update: { value: String(seconds) },
    create: { key: HOME_BANNER_INTERVAL_KEY, value: String(seconds) },
  });
}

const LANDING_CONTENT_KEY = "landingContent";

export async function getLandingContent(): Promise<LandingContent> {
  const row = await prisma.appSetting.findUnique({ where: { key: LANDING_CONTENT_KEY } });
  if (!row) return DEFAULT_LANDING_CONTENT;
  try {
    return sanitizeLandingContent(JSON.parse(row.value));
  } catch {
    return DEFAULT_LANDING_CONTENT;
  }
}

export async function setLandingContent(content: LandingContent): Promise<LandingContent> {
  const clean = sanitizeLandingContent(content);
  await prisma.appSetting.upsert({
    where: { key: LANDING_CONTENT_KEY },
    update: { value: JSON.stringify(clean) },
    create: { key: LANDING_CONTENT_KEY, value: JSON.stringify(clean) },
  });
  return clean;
}
