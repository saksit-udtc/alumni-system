// ค่าคงที่ที่ใช้ได้ทั้งฝั่ง client และ server (ห้าม import โมดูล node ที่นี่)
// ศิษย์เก่าดีเด่นเลือกยอดได้ 2 ระดับ (server ตรวจว่าต้องเป็นหนึ่งในค่านี้เท่านั้น ไม่เชื่อค่าอื่นจาก client)
//  - 5,000 บาท  → ได้รับเกียรติบัตรศิษย์เก่าดีเด่น
//  - 10,000 บาท → ได้รับโล่ศิษย์เก่าดีเด่น
export const DISTINGUISHED_ALUMNI_OPTIONS = [
  { amount: 5000, reward: "เกียรติบัตรศิษย์เก่าดีเด่น" },
  { amount: 10000, reward: "โล่ศิษย์เก่าดีเด่น" },
] as const;
export const DISTINGUISHED_ALUMNI_DEFAULT_AMOUNT = 10000;

// ผู้มีอุปการคุณ/ผู้สนับสนุนที่บริจาคตั้งแต่ยอดนี้ขึ้นไป ได้รับโล่ประกาศเกียรติคุณ
export const SPONSOR_PLAQUE_MIN_AMOUNT = 10000;
export const SPONSOR_PLAQUE_LABEL = "โล่ประกาศเกียรติคุณ";

// ช่วงวงเงินที่ผู้สนับสนุนกำหนดได้ (บาท)
export const SPONSOR_MIN_AMOUNT = 100;
export const SPONSOR_MAX_AMOUNT = 10000000;

export type SupportType = "distinguished_alumni" | "sponsor";

export const SUPPORT_TYPE_LABEL: Record<SupportType, string> = {
  distinguished_alumni: "ศิษย์เก่าดีเด่น",
  sponsor: "ผู้สนับสนุนงาน",
};

/** สิ่งที่ผู้ลงทะเบียนจะได้รับตามประเภทและยอดเงิน (null = ไม่มี) */
export function supportReward(type: SupportType, amount: number): string | null {
  if (type === "distinguished_alumni") {
    return DISTINGUISHED_ALUMNI_OPTIONS.find((o) => o.amount === amount)?.reward ?? null;
  }
  return amount >= SPONSOR_PLAQUE_MIN_AMOUNT ? SPONSOR_PLAQUE_LABEL : null;
}
