import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { logAdminAction } from "@/lib/auditLog";

/**
 * ทำเครื่องหมายขั้นตอนหน้างานของหลายออเดอร์พร้อมกัน
 * Body: { ids: string[], action: "labelPrinted" | "labelClear" | "packed" | "packedClear" }
 */
export async function POST(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF", "RESERVATION_STAFF"]);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids)
    ? body.ids.filter((x: unknown) => typeof x === "string" && x).slice(0, 500)
    : [];
  const action = body?.action;
  if (ids.length === 0) return jsonError("ยังไม่ได้เลือกคำสั่งซื้อ", 400);

  const now = new Date();
  let data: { labelPrintedAt?: Date | null; packedAt?: Date | null };
  switch (action) {
    case "labelPrinted":
      data = { labelPrintedAt: now };
      break;
    case "labelClear":
      data = { labelPrintedAt: null };
      break;
    case "packed":
      data = { packedAt: now };
      break;
    case "packedClear":
      data = { packedAt: null };
      break;
    default:
      return jsonError("action ไม่ถูกต้อง", 400);
  }

  const result = await prisma.merchOrder.updateMany({ where: { id: { in: ids } }, data });

  await logAdminAction({
    adminId: admin!.adminId,
    action: `MERCH_ORDER_MARK_${String(action).toUpperCase()}`,
    targetType: "MerchOrder",
    detail: `count=${result.count}`,
  });

  return NextResponse.json({ ok: true, updated: result.count });
}
