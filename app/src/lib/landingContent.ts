// Editable content for the public homepage (the "89th anniversary"
// promotional landing page at app/page.tsx). Stored as a single JSON blob
// in AppSetting (key: "landingContent") rather than its own table, since it
// is one singleton document edited as a whole from /admin/landing — see
// lib/settings.ts for the getter/setter. Gallery photos are the one part
// stored as real rows (LandingGalleryImage) because they need individual
// upload/delete/reorder, not because they're structurally different.

export interface LandingTimelineItem {
  time: string;
  title: string;
  description: string;
}

export interface LandingHonorGuest {
  name: string;
  role: string;
  photoUrl: string; // optional; empty string = show initial-letter avatar
}

export interface LandingMerchItem {
  name: string;
  description: string;
  badge: string; // e.g. "รวมในบัตร" or "สั่งซื้อเพิ่ม"
  icon: "polo" | "tshirt" | "coin" | "cup";
  imageUrl: string; // optional real photo; falls back to the icon when empty
}

export interface LandingSponsorTier {
  tier: string; // e.g. "ระดับสูงสุด"
  label: string; // e.g. "Gold Sponsor"
  price: string; // e.g. "20,000 บาท"
  benefits: string[];
  logoUrl: string; // optional; empty string = no logo shown
}

export interface LandingFaqItem {
  question: string;
  answer: string;
}

export interface LandingContent {
  eventDateISO: string; // ISO datetime with offset, drives the countdown
  eventDateLabel: string; // long Thai label, e.g. "วันเสาร์ที่ 20 ธันวาคม 2569"
  eventDateShortLabel: string; // short label, e.g. "20 ธ.ค. 2569"
  registrationTime: string; // e.g. "17:00 น."
  venueName: string;
  venueAddress: string;
  parkingNote: string;
  mapUrl: string;
  pricePerSeat: number;
  pricePerTable: number;
  seatCapacityLabel: string; // e.g. "~600 ที่"
  heroTitleLine1: string;
  heroTitleLine2: string;
  heroLead: string;
  heroImageUrl: string; // optional background photo for the hero section
  timeline: LandingTimelineItem[];
  honorGuests: LandingHonorGuest[];
  merchItems: LandingMerchItem[];
  sponsors: LandingSponsorTier[];
  faq: LandingFaqItem[];
}

export const DEFAULT_LANDING_CONTENT: LandingContent = {
  eventDateISO: "2026-12-20T17:00:00+07:00",
  eventDateLabel: "วันเสาร์ที่ 20 ธันวาคม 2569",
  eventDateShortLabel: "20 ธ.ค. 2569",
  registrationTime: "17:00 น.",
  venueName: "หอประชุม วท.อุดรธานี",
  venueAddress: "หอประชุมวิทยาลัยเทคนิคอุดรธานี ถนนมุขมนตรี ตำบลหมากแข้ง อำเภอเมืองอุดรธานี จังหวัดอุดรธานี",
  parkingNote: "มีลานจอดรถภายในบริเวณวิทยาลัย รายละเอียดจุดจอดจะประกาศก่อนวันงาน",
  mapUrl: "",
  pricePerSeat: 599,
  pricePerTable: 5500,
  seatCapacityLabel: "~600 ที่",
  heroTitleLine1: "คืนสู่เหย้า",
  heroTitleLine2: "ช่างเทคนิครุ่นเรา",
  heroLead:
    "89 ปีแห่งการสร้างช่างฝีมือให้แผ่นดิน กลับมาพบเพื่อน พบครู และร่วมฉลองค่ำคืนแห่งความทรงจำอีกครั้ง",
  heroImageUrl: "",
  timeline: [
    { time: "17:00", title: "เริ่มลงทะเบียน", description: "รับของที่ระลึกและ QR Code เข้างาน" },
    { time: "18:30", title: "พิธีเปิดงาน", description: "กล่าวเปิดงานโดยผู้อำนวยการวิทยาลัย" },
    { time: "19:00", title: "พิธีมุทิตาจิตครูอาวุโส", description: "ตัวแทนศิษย์เก่ามอบของที่ระลึกแด่คุณครู" },
    { time: "19:45", title: "มอบทุนการศึกษา", description: "โดยผู้สนับสนุนหลักของงาน" },
    { time: "20:15", title: "รับประทานอาหารค่ำ + การแสดง", description: "วงดนตรีจากศิษย์เก่าและนักศึกษาปัจจุบัน" },
    { time: "21:30", title: "จับรางวัล", description: "ลุ้นของรางวัลจากผู้สนับสนุนงาน" },
    { time: "22:00", title: "ปิดงาน", description: "ขอบคุณผู้ร่วมงานทุกท่าน" },
  ],
  honorGuests: [
    { name: "ผู้อำนวยการกิตติคุณ", role: "อดีตผู้อำนวยการวิทยาลัย", photoUrl: "" },
    { name: "ครูอาวุโส แผนกช่างยนต์", role: "ผู้วางรากฐานหลักสูตรช่างยนต์", photoUrl: "" },
    { name: "ครูอาวุโส แผนกไฟฟ้า", role: "ผู้บุกเบิกแผนกช่างไฟฟ้ากำลัง", photoUrl: "" },
  ],
  merchItems: [
    { name: "เสื้อโปโล คอปก", description: "ปักอก \"89 ปี · วท.อุดรธานี\" ผ้าค็อตตอนผสม สีกรมท่า-ทอง", badge: "รวมในบัตร", icon: "polo", imageUrl: "" },
    { name: "เสื้อยืด คอกลม", description: "สกรีนโลโก้ 89 ปี ผ้านุ่มใส่สบาย เลือกแทนคอปกได้ 1 ตัวต่อบัตร", badge: "รวมในบัตร", icon: "tshirt", imageUrl: "" },
    { name: "เหรียญที่ระลึก พระวิษณุ", description: "เหรียญที่ระลึกฉลอง 89 ปี ผลิตจำนวนจำกัด สำหรับศิษย์เก่าที่สั่งจองล่วงหน้า", badge: "สั่งซื้อเพิ่ม", icon: "coin", imageUrl: "" },
    { name: "แก้วเก็บความเย็น (เยติ)", description: "แก้วสแตนเลสเก็บความเย็น สกรีนตราสัญลักษณ์ 89 ปี พร้อมฝาปิดกันหก", badge: "สั่งซื้อเพิ่ม", icon: "cup", imageUrl: "" },
  ],
  sponsors: [
    { tier: "ระดับสูงสุด", label: "Gold Sponsor", price: "20,000 บาท", benefits: ["แสดงโลโก้จุดเด่นรอบงาน", "ขึ้นมอบทุนการศึกษาบนเวที", "นำเสนอแบรนด์บนเวที 10 นาที"], logoUrl: "" },
    { tier: "ระดับกลาง", label: "Silver Sponsor", price: "10,000 บาท", benefits: ["แสดงโลโก้รอบบริเวณงาน", "กล่าวขอบคุณบนเวที"], logoUrl: "" },
    { tier: "ระดับทั่วไป", label: "Bronze Sponsor", price: "5,000 บาท", benefits: ["แสดงโลโก้บนป้ายผู้สนับสนุน"], logoUrl: "" },
  ],
  faq: [
    { question: "งานจัดวันไหน เวลาอะไร?", answer: "วันเสาร์ที่ 20 ธันวาคม 2569 เริ่มลงทะเบียนตั้งแต่ 17:00 น. เป็นต้นไป" },
    { question: "บัตรราคาเท่าไหร่ รวมอะไรบ้าง?", answer: "599 บาทต่อที่นั่ง รวมเสื้อโปโลที่ระลึก บุฟเฟ่ต์อาหารค่ำ และกิจกรรมตลอดงาน หรือจองเป็นโต๊ะ 10 ที่นั่ง ราคา 5,500 บาท" },
    { question: "จองโต๊ะและชำระเงินอย่างไร?", answer: "จองผ่านระบบจองโต๊ะออนไลน์ของวิทยาลัย เลือกโต๊ะหรือที่นั่ง แนบสลิปโอนเงิน แล้วรอการยืนยัน" },
    { question: "จะได้รับ QR Code เข้างานเมื่อไหร่?", answer: "หลังจากเจ้าหน้าที่ตรวจสอบสลิปและยืนยันการชำระเงินแล้ว ระบบจะส่ง QR Code เข้างานให้ทันที" },
    { question: "ส่งภาพเก่าสมัยเรียนเข้าร่วมได้ไหม?", answer: "ได้ครับ สามารถส่งภาพเก่าเข้ามาได้ ภาพที่คัดเลือกอาจนำขึ้นจอใหญ่ในค่ำคืนงาน" },
  ],
};

const MERCH_ICONS: LandingMerchItem["icon"][] = ["polo", "tshirt", "coin", "cup"];

function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}
function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function arr<T>(v: unknown, fallback: T[]): T[] {
  return Array.isArray(v) ? (v as T[]) : fallback;
}

/**
 * Merges a partial/untrusted JSON blob (from AppSetting, or an admin PUT
 * body) on top of the defaults, field by field — so a missing or malformed
 * key never crashes the homepage or admin form, it just falls back.
 */
export function sanitizeLandingContent(input: unknown): LandingContent {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const d = DEFAULT_LANDING_CONTENT;

  const timeline = arr<Partial<LandingTimelineItem>>(raw.timeline, []).map((t) => ({
    time: str(t?.time, ""),
    title: str(t?.title, ""),
    description: str(t?.description, ""),
  }));

  const honorGuests = arr<Partial<LandingHonorGuest>>(raw.honorGuests, []).map((h) => ({
    name: str(h?.name, ""),
    role: str(h?.role, ""),
    photoUrl: str(h?.photoUrl, ""),
  }));

  const merchItems = arr<Partial<LandingMerchItem>>(raw.merchItems, []).map((m) => ({
    name: str(m?.name, ""),
    description: str(m?.description, ""),
    badge: str(m?.badge, ""),
    icon: MERCH_ICONS.includes(m?.icon as LandingMerchItem["icon"]) ? (m!.icon as LandingMerchItem["icon"]) : "polo",
    imageUrl: str(m?.imageUrl, ""),
  }));

  const sponsors = arr<Partial<LandingSponsorTier>>(raw.sponsors, []).map((s) => ({
    tier: str(s?.tier, ""),
    label: str(s?.label, ""),
    price: str(s?.price, ""),
    benefits: arr<string>(s?.benefits, []).map((b) => str(b, "")).filter(Boolean),
    logoUrl: str(s?.logoUrl, ""),
  }));

  const faq = arr<Partial<LandingFaqItem>>(raw.faq, []).map((f) => ({
    question: str(f?.question, ""),
    answer: str(f?.answer, ""),
  }));

  return {
    eventDateISO: str(raw.eventDateISO, d.eventDateISO),
    eventDateLabel: str(raw.eventDateLabel, d.eventDateLabel),
    eventDateShortLabel: str(raw.eventDateShortLabel, d.eventDateShortLabel),
    registrationTime: str(raw.registrationTime, d.registrationTime),
    venueName: str(raw.venueName, d.venueName),
    venueAddress: str(raw.venueAddress, d.venueAddress),
    parkingNote: str(raw.parkingNote, d.parkingNote),
    mapUrl: str(raw.mapUrl, d.mapUrl),
    pricePerSeat: num(raw.pricePerSeat, d.pricePerSeat),
    pricePerTable: num(raw.pricePerTable, d.pricePerTable),
    seatCapacityLabel: str(raw.seatCapacityLabel, d.seatCapacityLabel),
    heroTitleLine1: str(raw.heroTitleLine1, d.heroTitleLine1),
    heroTitleLine2: str(raw.heroTitleLine2, d.heroTitleLine2),
    heroLead: str(raw.heroLead, d.heroLead),
    heroImageUrl: str(raw.heroImageUrl, d.heroImageUrl),
    timeline: timeline.length ? timeline : d.timeline,
    honorGuests: honorGuests.length ? honorGuests : d.honorGuests,
    merchItems: merchItems.length ? merchItems : d.merchItems,
    sponsors: sponsors.length ? sponsors : d.sponsors,
    faq: faq.length ? faq : d.faq,
  };
}
