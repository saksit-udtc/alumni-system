import { NextResponse } from "next/server";
import { getPosterInfo } from "@/lib/poster";

// สาธารณะ — หน้าแรกอ่านโปสเตอร์ที่ใช้งานอยู่ (จัดการที่ /admin/poster)
export const dynamic = "force-dynamic";

export async function GET() {
  const { enabled, imageUrl } = await getPosterInfo();
  return NextResponse.json({ enabled, imageUrl });
}
