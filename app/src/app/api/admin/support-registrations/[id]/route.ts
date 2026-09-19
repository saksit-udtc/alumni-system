import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { logAdminAction } from "@/lib/auditLog";
import { sendSupportRegistrationConfirmedEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

// PATCH { action: "approve" | "reject", note?: string }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN", "FINANCE_STAFF"]);
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  if (action !== "approve" && action !== "reject") return jsonError("action ไม่ถูกต้อง");
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";

  const existing = await prisma.supportRegistration.findUnique({ where: { id: params.id } });
  if (!existing) return jsonError("ไม่พบรายการ", 404);

  const updated = await prisma.supportRegistration.update({
    where: { id: params.id },
    data: {
      paymentStatus: action === "approve" ? "confirmed" : "rejected",
      adminNote: note || existing.adminNote,
    },
  });
  await logAdminAction({
    adminId: admin!.adminId,
    action: action === "approve" ? "SUPPORT_REG_APPROVE" : "SUPPORT_REG_REJECT",
    targetType: "SupportRegistration",
    targetId: updated.id,
    detail: `code=${updated.code}`,
  });
  // อนุมัติแล้ว -> ส่งอีเมลยืนยัน (fail-soft)
  if (action === "approve" && existing.paymentStatus !== "confirmed") {
    await sendSupportRegistrationConfirmedEmail({
      to: updated.email,
      name: updated.name,
      type: updated.type,
      code: updated.code,
      amount: Number(updated.amount),
    });
  }
  return NextResponse.json({ ok: true, paymentStatus: updated.paymentStatus });
}
