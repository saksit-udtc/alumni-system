import { NextResponse } from "next/server";
import { getSalesSummary } from "@/lib/salesSummary";

// ข้อมูลสรุปแบบเปิดสาธารณะ (ไม่ต้องล็อกอิน) — เป็นจำนวนรวมเท่านั้น
// ไม่มีชื่อ/เบอร์โทร/ข้อมูลส่วนบุคคล และ "ตัดยอดเงินทุกรายการออกที่ฝั่งเซิร์ฟเวอร์" (ไม่ส่งไปถึงเบราว์เซอร์เลย)
export const dynamic = "force-dynamic";

export async function GET() {
  const d = await getSalesSummary();
  const zeroB = { confirmed: 0, awaiting: 0, pending: 0 };
  return NextResponse.json({
    ...d,
    merch: d.merch.map((r) => ({ ...r, revenueConfirmed: 0 })),
    shippingConfirmed: 0,
    merchTotals: { ...d.merchTotals, revenueConfirmed: 0 },
    events: d.events.map((e) => ({ ...e, revenue: zeroB })),
  });
}
