// อ่านน้ำหนัก/ขนาดพัสดุต่อชิ้นจาก body ของ API สินค้า (admin)
// ฟิลด์ที่ไม่ส่งมา = ไม่แก้; ส่งค่าว่าง/null = ล้างค่า; ไม่เช่นนั้นต้องเป็นจำนวนเต็ม > 0

const FIELDS: { key: "weightGrams" | "lengthCm" | "widthCm" | "heightCm"; label: string; max: number }[] = [
  { key: "weightGrams", label: "น้ำหนัก (กรัม)", max: 30000 },
  { key: "lengthCm", label: "ความยาว (ซม.)", max: 200 },
  { key: "widthCm", label: "ความกว้าง (ซม.)", max: 200 },
  { key: "heightCm", label: "ความสูง (ซม.)", max: 200 },
];

export function parseParcelFields(
  body: Record<string, unknown>,
): { data: Partial<Record<(typeof FIELDS)[number]["key"], number | null>> } | { error: string } {
  const data: Partial<Record<(typeof FIELDS)[number]["key"], number | null>> = {};
  for (const f of FIELDS) {
    const v = body[f.key];
    if (v === undefined) continue;
    if (v === null || v === "") {
      data[f.key] = null;
      continue;
    }
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0 || n > f.max) {
      return { error: `${f.label} ต้องเป็นจำนวนเต็มมากกว่า 0 และไม่เกิน ${f.max.toLocaleString()}` };
    }
    data[f.key] = n;
  }
  return { data };
}
