import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiHelpers";

export const dynamic = "force-dynamic";

const ROLES = ["SUPER_ADMIN", "FINANCE_STAFF"] as const;

export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req, [...ROLES]);
  if (response) return response;

  const rows = await prisma.supportRegistration.findMany({ orderBy: { createdAt: "desc" } });
  const registrations = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      code: r.code,
      type: r.type,
      name: r.name,
      detail: r.detail,
      phone: r.phone,
      email: r.email,
      amount: Number(r.amount),
      paymentStatus: r.paymentStatus,
      adminNote: r.adminNote,
      easyslipStatus: r.easyslipStatus,
      easyslipMessage: r.easyslipMessage,
      createdAt: r.createdAt,
      slipUrl: r.slipFileKey ? `/api/admin/slip/support/${r.id}` : null,
    }))
  );
  return NextResponse.json({ registrations });
}
