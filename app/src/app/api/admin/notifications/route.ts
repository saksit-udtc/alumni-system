import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiHelpers";
import { getNotifications } from "@/lib/adminTodo";

// route นี้อ่านฐานข้อมูล — ต้องไม่ถูก prerender ตอน docker build (ไม่มี DATABASE_URL)
export const dynamic = "force-dynamic";

/**
 * งานค้างของบทบาทที่ล็อกอินอยู่ (ทุกบทบาทเรียกได้ แต่จะได้เฉพาะรายการที่บทบาทนั้นมีสิทธิ์)
 * ใช้กับกระดิ่งแจ้งเตือน + ป้ายตัวเลขข้างเมนู; เจ้าหน้าที่เช็คอินจะได้รายการว่าง
 */
export async function GET(req: NextRequest) {
  const { admin, response } = requireAdmin(req);
  if (response) return response;

  const items = await getNotifications(admin!.role);
  const total = items.filter((i) => i.inBadge).reduce((sum, i) => sum + i.count, 0);
  return NextResponse.json({ items, total });
}
