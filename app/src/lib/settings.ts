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

const POS_PROMPTPAY_ID_KEY = "posPromptPayId";

/** PromptPay target (mobile number, national/tax ID, or e-Wallet ID) the
 * POS's payment QR is generated against — see lib/promptpay.ts. Empty
 * string until an admin sets one, in which case the POS just doesn't show
 * a QR for "โอนเงิน" (staff can still confirm the sale, they just tell the
 * customer the account manually as before). */
export async function getPosPromptPayId(): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key: POS_PROMPTPAY_ID_KEY } });
  return row?.value?.trim() || "";
}

export async function setPosPromptPayId(id: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: POS_PROMPTPAY_ID_KEY },
    update: { value: id.trim() },
    create: { key: POS_PROMPTPAY_ID_KEY, value: id.trim() },
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

// ---- ธีมสีของเว็บไซต์ (ทั้งเว็บ รวมหน้าแรกและแอดมิน) ----
// ค่าที่ใช้ได้: "navy-gold" (กรมท่า-ทอง เหมือนหน้าแรกเดิม) | "white-gold" (ขาว-ทอง) | "blue-orange" (น้ำเงิน-ส้ม แบบเว็บ FunRun)
// layout.tsx อ่านค่านี้ใส่ data-theme ที่ <html> — นิยามสีอยู่ใน globals.css
export const SITE_THEMES = ["navy-gold", "white-gold", "blue-orange"] as const;
export type SiteTheme = (typeof SITE_THEMES)[number];
export const DEFAULT_SITE_THEME: SiteTheme = "navy-gold";

const SITE_THEME_KEY = "siteTheme";

export function isSiteTheme(v: unknown): v is SiteTheme {
  return typeof v === "string" && (SITE_THEMES as readonly string[]).includes(v);
}

/** Never throws — ถ้าอ่านฐานข้อมูลไม่ได้ (เช่นตอน build) จะใช้ธีมเริ่มต้น */
export async function getSiteTheme(): Promise<SiteTheme> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SITE_THEME_KEY } });
    return isSiteTheme(row?.value) ? row!.value as SiteTheme : DEFAULT_SITE_THEME;
  } catch {
    return DEFAULT_SITE_THEME;
  }
}

export async function setSiteTheme(theme: SiteTheme): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: SITE_THEME_KEY },
    update: { value: theme },
    create: { key: SITE_THEME_KEY, value: theme },
  });
}

// ---- โปสเตอร์งานบนหน้าแรก (อัปโหลดที่ /admin/poster) ----
// เก็บ key ของไฟล์ใน bucket landing-assets (public) ที่ poster/<uuid>.<ext>
// ถ้ายังไม่เคยอัปโหลด ใช้ภาพเริ่มต้น /poster.jpg ที่แนบมากับแอป (public/poster.jpg)
export const DEFAULT_POSTER_URL = "/poster.jpg";
const POSTER_IMAGE_KEY = "posterImageKey";
const POSTER_ENABLED_KEY = "posterEnabled";

export interface PosterSetting {
  /** key ใน LANDING_ASSETS_BUCKET; null = ใช้ภาพเริ่มต้น */
  imageKey: string | null;
  /** false = ซ่อนส่วนโปสเตอร์จากหน้าแรก */
  enabled: boolean;
}

/** Never throws — อ่านไม่ได้ (เช่นตอน build) จะใช้ภาพเริ่มต้น + แสดงผล */
export async function getPosterSetting(): Promise<PosterSetting> {
  try {
    const rows = await prisma.appSetting.findMany({
      where: { key: { in: [POSTER_IMAGE_KEY, POSTER_ENABLED_KEY] } },
    });
    const key = rows.find((r) => r.key === POSTER_IMAGE_KEY)?.value || null;
    const enabledRow = rows.find((r) => r.key === POSTER_ENABLED_KEY)?.value;
    return { imageKey: key, enabled: enabledRow !== "false" };
  } catch {
    return { imageKey: null, enabled: true };
  }
}

export async function setPosterImageKey(key: string | null): Promise<void> {
  if (key === null) {
    await prisma.appSetting.deleteMany({ where: { key: POSTER_IMAGE_KEY } });
    return;
  }
  await prisma.appSetting.upsert({
    where: { key: POSTER_IMAGE_KEY },
    update: { value: key },
    create: { key: POSTER_IMAGE_KEY, value: key },
  });
}

export async function setPosterEnabled(enabled: boolean): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: POSTER_ENABLED_KEY },
    update: { value: String(enabled) },
    create: { key: POSTER_ENABLED_KEY, value: String(enabled) },
  });
}
