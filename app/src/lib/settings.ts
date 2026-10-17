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

// ---- ภาพแผนผังการจัดงาน (แสดงเป็นภาพย่อบนหน้าจองโต๊ะ คลิกขยายเต็มจอ) ----
// เก็บเป็น key ใน FLOOR_PLANS_BUCKET ต่อ 1 งาน; ไม่มีแถว = ไม่แสดงการ์ด
// (แยกจาก Event.floorPlanUrl ที่เป็นภาพพื้นหลังสำหรับวางตำแหน่งโต๊ะ)
const eventLayoutKey = (eventId: string) => `eventLayoutImage:${eventId}`;

/** Never throws — อ่านไม่ได้ถือว่าไม่มีภาพ */
export async function getEventLayoutImageKey(eventId: string): Promise<string | null> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: eventLayoutKey(eventId) } });
    return row?.value || null;
  } catch {
    return null;
  }
}

export async function setEventLayoutImageKey(eventId: string, key: string | null): Promise<void> {
  if (key === null) {
    await prisma.appSetting.deleteMany({ where: { key: eventLayoutKey(eventId) } });
    return;
  }
  await prisma.appSetting.upsert({
    where: { key: eventLayoutKey(eventId) },
    update: { value: key },
    create: { key: eventLayoutKey(eventId), value: key },
  });
}

// ---- ผู้ประสานงาน/ช่องทางติดต่อ (พิมพ์ท้าย PDF หลักฐานการชำระเงิน) ----
// แก้ได้ที่ /admin/settings (เฉพาะ SUPER_ADMIN) เก็บเป็น JSON ใน AppSetting — ไม่ต้อง migrate
export interface ContactPerson {
  name: string;
  phone: string;
}
export interface ContactSettings {
  /** ติดต่อจองโต๊ะ (เช่น คุณแพตตี้) */
  bookingContacts: ContactPerson[];
  /** ผู้ประสานงาน */
  coordinators: ContactPerson[];
}

export const DEFAULT_CONTACT_SETTINGS: ContactSettings = {
  bookingContacts: [
    { name: "คุณแพ็ททรียา เจียมสันต์ (แพตตี้)", phone: "064-319-1010" },
    { name: "คุณศิริกาญจน์", phone: "095-169-4156" },
  ],
  coordinators: [
    { name: "ครูสมฤทัย ม่วงผุย", phone: "065-123-7339" },
    { name: "ครูอัญชลี บุญฤทธิ์", phone: "081-915-6961" },
    { name: "ครูปรีชา รักษาพล", phone: "094-486-1221" },
    { name: "ครูศักดิ์สิทธิ์ สร้อยสังวาลย์", phone: "081-974-9729" },
    { name: "ครูบุษราภรณ์ แสนจันทร์", phone: "093-319-9988" },
  ],
};

const CONTACT_SETTINGS_KEY = "proofContacts";
const MAX_CONTACTS = 12;

function cleanPeople(v: unknown): ContactPerson[] {
  if (!Array.isArray(v)) return [];
  const out: ContactPerson[] = [];
  for (const it of v) {
    const name = typeof it?.name === "string" ? it.name.trim().slice(0, 80) : "";
    const phone = typeof it?.phone === "string" ? it.phone.trim().slice(0, 30) : "";
    if (!name) continue; // ไม่มีชื่อ = ข้ามแถว
    out.push({ name, phone });
    if (out.length >= MAX_CONTACTS) break;
  }
  return out;
}

export function sanitizeContactSettings(v: any): ContactSettings {
  return {
    bookingContacts: cleanPeople(v?.bookingContacts),
    coordinators: cleanPeople(v?.coordinators),
  };
}

/** Never throws — ไม่มีแถว/อ่านไม่ได้ จะใช้ค่าเริ่มต้นตามโปสเตอร์ */
export async function getContactSettings(): Promise<ContactSettings> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: CONTACT_SETTINGS_KEY } });
    if (!row) return DEFAULT_CONTACT_SETTINGS;
    return sanitizeContactSettings(JSON.parse(row.value));
  } catch {
    return DEFAULT_CONTACT_SETTINGS;
  }
}

export async function setContactSettings(v: unknown): Promise<ContactSettings> {
  const clean = sanitizeContactSettings(v);
  await prisma.appSetting.upsert({
    where: { key: CONTACT_SETTINGS_KEY },
    update: { value: JSON.stringify(clean) },
    create: { key: CONTACT_SETTINGS_KEY, value: JSON.stringify(clean) },
  });
  return clean;
}

const MERCH_PICKUP_ENABLED_KEY = "merchPickupEnabled";

/** ข้อความที่เก็บในช่อง shippingAddress ของออเดอร์ที่เลือก "รับสินค้าที่วิทยาลัย" */
export const MERCH_PICKUP_ADDRESS_TEXT = "รับสินค้าเองที่วิทยาลัยเทคนิคอุดรธานี (ไม่มีค่าจัดส่ง)";

/** เปิด/ปิดตัวเลือก "รับสินค้าที่วิทยาลัย" ในหน้าสั่งซื้อของที่ระลึก (ค่าเริ่มต้น = ปิด) */
export async function getMerchPickupEnabled(): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: MERCH_PICKUP_ENABLED_KEY } });
  return row?.value === "true";
}

export async function setMerchPickupEnabled(enabled: boolean): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: MERCH_PICKUP_ENABLED_KEY },
    update: { value: enabled ? "true" : "false" },
    create: { key: MERCH_PICKUP_ENABLED_KEY, value: enabled ? "true" : "false" },
  });
}
