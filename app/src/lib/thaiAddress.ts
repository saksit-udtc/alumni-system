// ที่อยู่จัดส่งแบบแยกช่อง (ตามรูปแบบที่ API ขนส่งอย่าง Flash Express ต้องใช้)
// ไฟล์นี้ใช้ได้ทั้งฝั่ง client และ server — ห้าม import prisma ที่นี่

export interface ThaiAddress {
  /** บ้านเลขที่ หมู่ ซอย ถนน อาคาร */
  line: string;
  subdistrict: string; // ตำบล/แขวง
  district: string; // อำเภอ/เขต
  province: string; // จังหวัด
  postcode: string; // รหัสไปรษณีย์ 5 หลัก
  /** true = ผู้สั่งเลือก "ไม่พบที่อยู่ในรายการ" และพิมพ์อำเภอ/ตำบล/รหัสไปรษณีย์เอง */
  manual?: boolean;
}

export const EMPTY_ADDRESS: ThaiAddress = { line: "", subdistrict: "", district: "", province: "", postcode: "", manual: false };

export const THAI_PROVINCES = [
  "กรุงเทพมหานคร","กระบี่","กาญจนบุรี","กาฬสินธุ์","กำแพงเพชร","ขอนแก่น","จันทบุรี","ฉะเชิงเทรา","ชลบุรี","ชัยนาท",
  "ชัยภูมิ","ชุมพร","เชียงราย","เชียงใหม่","ตรัง","ตราด","ตาก","นครนายก","นครปฐม","นครพนม",
  "นครราชสีมา","นครศรีธรรมราช","นครสวรรค์","นนทบุรี","นราธิวาส","น่าน","บึงกาฬ","บุรีรัมย์","ปทุมธานี","ประจวบคีรีขันธ์",
  "ปราจีนบุรี","ปัตตานี","พระนครศรีอยุธยา","พะเยา","พังงา","พัทลุง","พิจิตร","พิษณุโลก","เพชรบุรี","เพชรบูรณ์",
  "แพร่","ภูเก็ต","มหาสารคาม","มุกดาหาร","แม่ฮ่องสอน","ยโสธร","ยะลา","ร้อยเอ็ด","ระนอง","ระยอง",
  "ราชบุรี","ลพบุรี","ลำปาง","ลำพูน","เลย","ศรีสะเกษ","สกลนคร","สงขลา","สตูล","สมุทรปราการ",
  "สมุทรสงคราม","สมุทรสาคร","สระแก้ว","สระบุรี","สิงห์บุรี","สุโขทัย","สุพรรณบุรี","สุราษฎร์ธานี","สุรินทร์","หนองคาย",
  "หนองบัวลำภู","อ่างทอง","อำนาจเจริญ","อุดรธานี","อุตรดิตถ์","อุทัยธานี","อุบลราชธานี",
];

/** คืนข้อความ error รายช่อง (key = addrLine / addrSubdistrict / addrDistrict / addrProvince / addrPostcode) */
export function validateThaiAddress(a: ThaiAddress): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!a.line.trim()) errs.addrLine = "กรุณากรอกบ้านเลขที่/หมู่/ซอย/ถนน";
  if (!a.subdistrict.trim()) errs.addrSubdistrict = "กรุณากรอกตำบล/แขวง";
  if (!a.district.trim()) errs.addrDistrict = "กรุณากรอกอำเภอ/เขต";
  if (!a.province.trim()) errs.addrProvince = "กรุณาเลือกจังหวัด";
  else if (!THAI_PROVINCES.includes(a.province.trim())) errs.addrProvince = "กรุณาเลือกจังหวัดจากรายการ";
  if (!/^\d{5}$/.test(a.postcode.trim())) errs.addrPostcode = "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก";
  return errs;
}

export function normalizeThaiAddress(a: Partial<ThaiAddress>): ThaiAddress {
  const t = (v?: string) => (v ?? "").trim();
  return {
    line: t(a.line),
    subdistrict: t(a.subdistrict),
    district: t(a.district),
    province: t(a.province),
    postcode: t(a.postcode),
    manual: !!a.manual,
  };
}

/** ประกอบเป็นข้อความที่อยู่บรรทัดเดียว เก็บในช่อง shippingAddress เดิม (อีเมล/ใบปริ้น/ส่งออก Excel ใช้ต่อได้) */
export function composeThaiAddress(a: ThaiAddress): string {
  const isBkk = a.province === "กรุงเทพมหานคร";
  const sub = isBkk ? `แขวง${a.subdistrict}` : `ตำบล${a.subdistrict}`;
  const dist = isBkk ? `เขต${a.district}` : `อำเภอ${a.district}`;
  const prov = isBkk ? a.province : `จังหวัด${a.province}`;
  return `${a.line} ${sub} ${dist} ${prov} ${a.postcode}`.replace(/\s+/g, " ").trim();
}
