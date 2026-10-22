// รวมน้ำหนัก/ขนาดพัสดุต่อออเดอร์จากข้อมูลน้ำหนัก-ขนาดต่อชิ้นของสินค้า
// (ใช้ส่งให้ขนส่งอย่าง Flash Express คิดค่าส่งและสร้างรายการ) — ไม่ import prisma ที่นี่

export interface ParcelLine {
  quantity: number;
  /** กรัมต่อชิ้น — null/ไม่ระบุ = ยังไม่ได้กรอกข้อมูลสินค้านี้ */
  weightGrams?: number | null;
  /** ขนาดต่อชิ้น (ซม.) ตอนบรรจุ เช่น เสื้อพับแล้ว */
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
}

export interface Parcel {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  /** true = มีสินค้าอย่างน้อย 1 รายการที่ยังไม่ได้กรอกน้ำหนัก/ขนาด (ค่ารวมต่ำกว่าจริง) */
  incomplete: boolean;
}

/**
 * กติกา: น้ำหนัก = ผลรวม (น้ำหนักต่อชิ้น × จำนวน) + น้ำหนักบรรจุภัณฑ์ (packagingGrams)
 * ขนาด: ยาว = ค่ามากสุดของทุกชิ้น, กว้าง = ค่ามากสุดของทุกชิ้น, สูง = ผลรวม (สูง × จำนวน) เพราะซ้อนกันในกล่องเดียว
 */
export function computeParcel(lines: ParcelLine[], packagingGrams = 0): Parcel {
  let weight = 0;
  let length = 0;
  let width = 0;
  let height = 0;
  let incomplete = false;
  for (const l of lines) {
    const q = Math.max(0, Math.floor(l.quantity || 0));
    if (q === 0) continue;
    const w = l.weightGrams ?? 0;
    if (!l.weightGrams || l.weightGrams <= 0) incomplete = true;
    if (!l.lengthCm || !l.widthCm || !l.heightCm) incomplete = true;
    weight += w * q;
    length = Math.max(length, l.lengthCm ?? 0);
    width = Math.max(width, l.widthCm ?? 0);
    height += (l.heightCm ?? 0) * q;
  }
  return {
    weightGrams: weight + Math.max(0, Math.floor(packagingGrams)),
    lengthCm: length,
    widthCm: width,
    heightCm: height,
    incomplete,
  };
}
