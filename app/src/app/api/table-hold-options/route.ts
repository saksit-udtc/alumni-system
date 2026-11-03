import { NextResponse } from "next/server";
import { getTableLongHold } from "@/lib/settings";

// สาธารณะ: หน้าจองโต๊ะใช้ถามว่าแอดมินเปิดตัวเลือก "ล็อกโต๊ะรอชำระเงินหลายวัน" ไว้หรือไม่ และกี่วัน
// (ค่าจริงถูกตรวจซ้ำฝั่งเซิร์ฟเวอร์ใน bookTable ทุกครั้ง)
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getTableLongHold());
}
