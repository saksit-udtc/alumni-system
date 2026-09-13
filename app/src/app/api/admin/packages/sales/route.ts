import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { bookPackage, PackageBookingError } from "@/lib/bookPackage";
import { logAdminAction } from "@/lib/auditLog";
import { PosPaymentMethod } from "@prisma/client";

// POS counter sale of a Package — payment is already settled in person, so
// this always calls bookPackage with immediateConfirm: true (mirrors how
// /api/admin/pos/sales/route.ts sells plain merch on the spot). The public
// online-booking path (Phase 2) will call bookPackage directly from a
// different, unauthenticated route instead of this one.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF", "RESERVATION_STAFF"]);
  if (!admin) return response;

  const body = await req.json().catch(() => null);
  const packageId = typeof body?.packageId === "string" ? body.packageId : "";
  const tableId = typeof body?.tableId === "string" ? body.tableId : "";
  const bookerName = typeof body?.bookerName === "string" ? body.bookerName : "";
  const bookerPhone = typeof body?.bookerPhone === "string" ? body.bookerPhone : "";
  const bookerEmail = typeof body?.bookerEmail === "string" ? body.bookerEmail : undefined;
  const paymentMethod = body?.paymentMethod === "cash" || body?.paymentMethod === "transfer"
    ? (body.paymentMethod as PosPaymentMethod)
    : null;

  if (!packageId || !tableId) return jsonError("ต้องระบุแพ็กเกจและโต๊ะที่ต้องการจอง");
  if (!paymentMethod) return jsonError("กรุณาเลือกวิธีชำระเงิน");

  try {
    const reservation = await bookPackage({
      packageId,
      tableId,
      bookerName,
      bookerPhone,
      bookerEmail,
      immediateConfirm: true,
      paymentMethod,
      cashierId: admin.adminId,
    });

    await logAdminAction({
      adminId: admin.adminId,
      action: "PACKAGE_SALE",
      targetType: "Reservation",
      targetId: reservation.id,
      detail: `ขายแพ็กเกจหน้างาน รหัสจอง ${reservation.bookingCode} ยอด ${reservation.totalAmount} บาท (${paymentMethod})`,
    });

    return NextResponse.json({ reservation }, { status: 201 });
  } catch (err) {
    if (err instanceof PackageBookingError) {
      return jsonError(err.message);
    }
    throw err;
  }
}
