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

// ขั้นตอน "วิธีจองและชำระเงิน" (บล็อก howTo บนหน้า /homecoming-89)
export interface LandingHowToStep {
  title: string;
  description: string;
}

export interface LandingFaqItem {
  question: string;
  answer: string;
}

// บล็อกของหน้า /homecoming-89 ที่แอดมินเปิด/ปิดการแสดงผลได้ (/admin/landing)
export const LANDING_SECTION_KEYS = ["hero", "tickets", "merch", "howTo", "schedule", "honorGuests", "venue", "sponsors", "faq", "finalCta"] as const;
export type LandingSectionKey = (typeof LANDING_SECTION_KEYS)[number];
export const LANDING_SECTION_LABELS: Record<LandingSectionKey, string> = {
  hero: "ส่วนหัว (ชื่องาน + นับถอยหลัง + รายละเอียดงาน)",
  tickets: "จองโต๊ะงานเลี้ยง (บัตร/ราคา)",
  merch: "ของที่ระลึก + ตารางไซซ์เสื้อ",
  howTo: "วิธีจองและชำระเงิน (ขั้นตอนจองโต๊ะ / สั่งซื้อ)",
  schedule: "กำหนดการ",
  honorGuests: "รายชื่อคุณครู / แขกผู้มีเกียรติ",
  venue: "สถานที่จัดงาน",
  sponsors: "ระดับผู้สนับสนุน",
  faq: "คำถามที่พบบ่อย (FAQ)",
  finalCta: "ปิดท้าย \"มาเจอกันนะ\" + ปุ่มจองโต๊ะ",
};
export type LandingVisibleSections = Record<LandingSectionKey, boolean>;
export const DEFAULT_VISIBLE_SECTIONS: LandingVisibleSections = {
  hero: true,
  tickets: true,
  merch: true,
  howTo: true,
  schedule: true,
  // สองบล็อกนี้ถูกซ่อนจากหน้าเว็บมาตั้งแต่ปรับดีไซน์ (22 ก.ย.) — ค่าเริ่มต้น "ซ่อน" เพื่อให้หน้าไม่เปลี่ยนจนกว่าแอดมินจะเปิดเอง
  honorGuests: false,
  venue: true,
  sponsors: false,
  faq: true,
  finalCta: true,
};

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
  howToBooking: LandingHowToStep[]; // ขั้นตอนจองโต๊ะ
  howToMerch: LandingHowToStep[]; // ขั้นตอนสั่งซื้อของที่ระลึก
  howToNotes: string[]; // ข้อควรรู้เรื่องการชำระเงิน (แสดงใต้ขั้นตอน)
  // เปิด/ปิดการแสดงผลแต่ละบล็อก — ค่าที่ไม่มีในข้อมูลเก่า = แสดง (true)
  visibleSections: LandingVisibleSections;
}

// ค่าเริ่มต้นอ้างอิงตามโปสเตอร์งาน "ประเพณี คืนสู่เหย้า 89 ปี เทคนิคอุดร"
// (วันอาทิตย์ที่ 27 ธ.ค. 2569 เวลา 18.00-24.00 น. ณ อาคารสันตุสสโก)
export const DEFAULT_LANDING_CONTENT: LandingContent = {
  eventDateISO: "2026-12-27T18:00:00+07:00",
  eventDateLabel: "วันอาทิตย์ที่ 27 ธันวาคม 2569",
  eventDateShortLabel: "27 ธ.ค. 2569",
  registrationTime: "18:00 น.",
  venueName: "อาคารโดมสันตุสสโก วท.อุดรธานี",
  venueAddress: "อาคารโดมสันตุสสโก วิทยาลัยเทคนิคอุดรธานี เลขที่ 3 ถ.วัฒนานุวงศ์ ต.หมากแข้ง อ.เมือง จ.อุดรธานี",
  parkingNote: "มีลานจอดรถใกล้ๆบริเวณวิทยาลัย รายละเอียดจุดจอดจะประกาศก่อนวันงาน",
  mapUrl: "",
  pricePerSeat: 625,
  pricePerTable: 5000,
  seatCapacityLabel: "~600 ที่",
  heroTitleLine1: "ประเพณีคืนสู่เหย้า",
  heroTitleLine2: "89 ปี เทคนิคอุดร",
  heroLead:
    "กลับมาพบเพื่อน พบครู และร่วมฉลองค่ำคืนแห่งความทรงจำ วันอาทิตย์ที่ 27 ธันวาคม 2569 เวลา 18.00-24.00 น. รายได้หลังหักค่าใช้จ่ายสมทบทุนจัดซื้อรถมินิบัสสำหรับนักเรียน-นักศึกษา",
  heroImageUrl: "",
  timeline: [
    { time: "18:00", title: "เริ่มลงทะเบียน", description: "รับของที่ระลึกและ QR Code เข้างาน" },
    { time: "19:00", title: "พิธีเปิดงาน", description: "กล่าวเปิดงานโดยผู้อำนวยการวิทยาลัย" },
    { time: "19:30", title: "พิธีมุทิตาจิตครูอาวุโส", description: "ตัวแทนศิษย์เก่ามอบของที่ระลึกแด่คุณครู" },
    { time: "20:15", title: "มอบโล่ศิษย์เก่าดีเด่น / ผู้มีอุปการคุณ", description: "และมอบเกียรติบัตรศิษย์เก่า" },
    { time: "20:45", title: "รับประทานอาหารโต๊ะจีน + การแสดง", description: "วงดนตรีจากศิษย์เก่าและนักศึกษาปัจจุบัน" },
    { time: "22:30", title: "จับรางวัล", description: "ลุ้นของรางวัลจากผู้สนับสนุนงาน" },
    { time: "24:00", title: "ปิดงาน", description: "ขอบคุณผู้ร่วมงานทุกท่าน" },
  ],
  honorGuests: [
    { name: "ผู้อำนวยการกิตติคุณ", role: "อดีตผู้อำนวยการวิทยาลัย", photoUrl: "" },
    { name: "ครูอาวุโส แผนกช่างยนต์", role: "ผู้วางรากฐานหลักสูตรช่างยนต์", photoUrl: "" },
    { name: "ครูอาวุโส แผนกไฟฟ้า", role: "ผู้บุกเบิกแผนกช่างไฟฟ้ากำลัง", photoUrl: "" },
  ],
  merchItems: [
    { name: "เสื้อคอโปโลที่ระลึก", description: "ปักอก \"89 ปี · วท.อุดรธานี\" ผ้าค็อตตอนผสม สีกรมท่า-ทอง เลือกไซซ์ได้ตอนลงทะเบียน", badge: "ตัวละ 350 บาท", icon: "polo", imageUrl: "" },
    { name: "เสื้อคอกลมที่ระลึก", description: "สกรีนโลโก้ 89 ปี ผ้านุ่มใส่สบาย เลือกไซซ์ได้ตอนลงทะเบียน", badge: "ตัวละ 199 บาท", icon: "tshirt", imageUrl: "" },
    { name: "เหรียญพระวิษณุกรรม", description: "เหรียญที่ระลึกฉลอง 89 ปี ผลิตจำนวนจำกัด สำหรับศิษย์เก่าที่สั่งจองล่วงหน้า", badge: "99 บาท", icon: "coin", imageUrl: "" },
    { name: "แก้วที่ระลึก", description: "แก้วน้ำที่ระลึกงานคืนสู่เหย้า 89 ปี สกรีนตราสัญลักษณ์ 89 ปี", badge: "299 บาท", icon: "cup", imageUrl: "" },
  ],
  sponsors: [
    { tier: "ศิษย์เก่าดีเด่น / ผู้มีอุปการคุณ", label: "โล่ศิษย์เก่าดีเด่น / โล่ประกาศเกียรติคุณ", price: "10,000 บาท", benefits: ["ศิษย์เก่าดีเด่น ยอด 10,000 บาท รับโล่ศิษย์เก่าดีเด่น", "ผู้มีอุปการคุณที่บริจาค 10,000 บาทขึ้นไป รับโล่ประกาศเกียรติคุณ", "ร่วมสนับสนุนทุนจัดซื้อรถมินิบัสสำหรับนักเรียน-นักศึกษา"], logoUrl: "" },
    { tier: "ศิษย์เก่าดีเด่น", label: "เกียรติบัตรศิษย์เก่าดีเด่น", price: "5,000 บาท", benefits: ["ศิษย์เก่าดีเด่น ยอด 5,000 บาท รับเกียรติบัตรศิษย์เก่าดีเด่น", "ร่วมสนับสนุนทุนจัดซื้อรถมินิบัสสำหรับนักเรียน-นักศึกษา"], logoUrl: "" },
  ],
  faq: [
    { question: "งานจัดวันไหน เวลาอะไร?", answer: "วันอาทิตย์ที่ 27 ธันวาคม 2569 เวลา 18.00-24.00 น. ณ อาคารสันตุสสโก วิทยาลัยเทคนิคอุดรธานี" },
    { question: "ราคาเท่าไหร่ รวมอะไรบ้าง?", answer: "โต๊ะจีน ราคา 5,000 บาทต่อโต๊ะ (8 ที่นั่ง) รวมอาหารและเครื่องดื่ม ส่วนของที่ระลึกสั่งซื้อเพิ่มได้ ได้แก่ เสื้อคอโปโล ตัวละ 350 บาท เสื้อคอกลม ตัวละ 199 บาท แก้วที่ระลึก 299 บาท และเหรียญพระวิษณุกรรม 99 บาท" },
    { question: "จองโต๊ะและชำระเงินอย่างไร?", answer: "จองผ่านระบบจองโต๊ะออนไลน์ของวิทยาลัย เลือกโต๊ะ แนบสลิปโอนเงิน แล้วรอการยืนยัน โอนเข้าบัญชีธนาคารกรุงไทย เลขที่ 664-391836-7 (นายธานินทร์ ทองเผ้า / นายสนั่น มูลสาร / นางณัชชา ชิ้นสวัสดิ์)" },
    { question: "งานนี้จัดเพื่ออะไร?", answer: "รายได้หลังหักค่าใช้จ่าย นำไปหาทุนจัดซื้อรถมินิบัสสำหรับนักเรียน-นักศึกษา วิทยาลัยเทคนิคอุดรธานี" },
    { question: "ติดต่อจองโต๊ะหรือสอบถามข้อมูลได้ที่ไหน?", answer: "ติดต่อจองโต๊ะ: คุณแพ็ทรียา 064-319-1010, คุณศิริทาญจน์ 095-169-4156, คุณภัทรอดี 095-647-4328 ผู้ประสานงาน: ครูสมฤทัย ม่วงผุย 065-123-7339, ครูอัญชลี บุญฤทธิ์ 081-915-6961, ครูปรีชา รักษาพล 094-486-1221, ครูศักดิ์สิทธิ์ สร้อยสังวาลย์ 081-974-9729, ครูบุษราภรณ์ แสนจันทร์ 088-753-8667" },
    { question: "จะได้รับ QR Code เข้างานเมื่อไหร่?", answer: "หลังจากเจ้าหน้าที่ตรวจสอบสลิปและยืนยันการชำระเงินแล้ว ระบบจะส่ง QR Code เข้างานให้ทันที" },
    { question: "ส่งภาพเก่าสมัยเรียนเข้าร่วมได้ไหม?", answer: "ได้ครับ สามารถส่งภาพเก่าเข้ามาได้ ภาพที่คัดเลือกอาจนำขึ้นจอใหญ่ในค่ำคืนงาน" },
  ],
  howToBooking: [
    { title: "เลือกโต๊ะ", description: "กดปุ่ม \"จองโต๊ะ\" เลือกโซน แล้วแตะโต๊ะที่ยังว่าง (สีเขียว) — 1 โต๊ะ 8 ที่นั่ง" },
    { title: "กรอกข้อมูลผู้จอง", description: "ชื่อ เบอร์โทร และอีเมล (ใช้รับอีเมลยืนยันการจอง) กรุณาตรวจให้ถูกต้อง" },
    { title: "โอนเงินและแนบสลิป", description: "โอนเงินตามยอดไปยังบัญชีที่แสดงในหน้าฟอร์ม แล้วแนบรูปสลิปก่อนกดยืนยันการจอง" },
    { title: "รอเจ้าหน้าที่ตรวจสลิป", description: "ได้รหัสการจองทันที สถานะ \"รอตรวจสอบ\" — ติดตามได้ที่หน้าเช็คสถานะด้วยรหัสการจอง + เบอร์โทร" },
    { title: "รับอีเมลยืนยัน + QR เช็คอิน", description: "เมื่อตรวจสลิปผ่าน ระบบส่งอีเมลยืนยันพร้อม QR Code — แสดงที่จุดลงทะเบียนในวันงาน" },
  ],
  howToMerch: [
    { title: "เลือกสินค้า", description: "กดปุ่ม \"สั่งซื้อของที่ระลึก\" ดูรูปด้านหน้า/ด้านหลัง เลือกไซซ์และจำนวน แล้วใส่ตะกร้า" },
    { title: "กรอกข้อมูลและที่อยู่จัดส่ง", description: "ระบบรวมค่าจัดส่งในยอดชำระให้อัตโนมัติ" },
    { title: "โอนเงินและแนบสลิป", description: "โอนเงินตามยอดรวมไปยังบัญชีที่แสดงในหน้าฟอร์ม แล้วแนบรูปสลิปก่อนกดยืนยันคำสั่งซื้อ" },
    { title: "รอเจ้าหน้าที่ตรวจสลิป", description: "ได้รหัสคำสั่งซื้อทันที — ติดตามได้ที่หน้าเช็คสถานะการสั่งซื้อด้วยรหัสคำสั่งซื้อ + เบอร์โทร" },
    { title: "รับอีเมลยืนยันและจัดส่ง", description: "ตรวจสลิปผ่านแล้วจะได้อีเมลยืนยัน และแจ้งอีกครั้งเมื่อจัดส่งสินค้า" },
  ],
  howToNotes: [
    "ชำระเงินด้วยการโอนเข้าบัญชีที่แสดงในหน้าฟอร์มเท่านั้น และต้องแนบสลิปตอนกดยืนยัน",
    "เก็บสลิปไว้จนกว่าจะได้รับอีเมลยืนยัน",
    "ถ้าไม่พบอีเมล กรุณาตรวจในโฟลเดอร์จดหมายขยะ (Spam / Junk)",
    "หากสลิปไม่ถูกต้อง เจ้าหน้าที่จะแจ้งผลทางอีเมล",
  ],
  visibleSections: DEFAULT_VISIBLE_SECTIONS,
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
function howToSteps(input: unknown, fallback: LandingHowToStep[]): LandingHowToStep[] {
  if (!Array.isArray(input)) return fallback;
  return arr<Partial<LandingHowToStep>>(input, [])
    .map((s) => ({ title: str(s?.title, ""), description: str(s?.description, "") }))
    .filter((s) => s.title || s.description);
}

function sanitizeVisibleSections(input: unknown): LandingVisibleSections {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_VISIBLE_SECTIONS };
  for (const k of LANDING_SECTION_KEYS) {
    if (typeof raw[k] === "boolean") out[k] = raw[k] as boolean;
  }
  return out;
}

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
    howToBooking: howToSteps(raw.howToBooking, d.howToBooking),
    howToMerch: howToSteps(raw.howToMerch, d.howToMerch),
    // [] ที่ตั้งใจลบทั้งหมด → ใช้ค่าเริ่มต้นเฉพาะตอนยังไม่เคยมีช่องนี้ (undefined)
    howToNotes: Array.isArray(raw.howToNotes)
      ? arr<string>(raw.howToNotes, []).map((n) => str(n, "")).filter(Boolean)
      : d.howToNotes,
    visibleSections: sanitizeVisibleSections(raw.visibleSections),
  };
}
