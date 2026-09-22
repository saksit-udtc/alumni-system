import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { bookPackage, PackageBookingError } from "@/lib/bookPackage";
import { sellMerchPackage, PackageMerchSaleError } from "@/lib/packageMerchSale";
import { logAdminAction } from "@/lib/auditLog";
import { PosPaymentMethod } from "@prisma/client";

// POS counter sale of a Package — payment is already settled in person.
// Branches on the package's own bookingType: a table+merch package (as
// before) always calls bookPackage with immediateConfirm: true and returns
// { reservation }; a merch-only package (bookingType null — see
// lib/packageMerchSale.ts) never touches a table at all and returns
// { sale } instead. The public online-booking path (Phase 2) calls
// bookPackage directly from a different, unauthenticated route — merch-only
// packages stay POS-only, same as "seats" packages already were.
export const dynamic = "force-dynamic";

function parseItemSizeSelections(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return out;
}

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
  const itemSizeSelections = parseItemSizeSelections(body?.itemSizeSelections);

  if (!packageId) return jsonError("ต้องระบุแพ็กเกจที่ต้องการขาย");
  if (!paymentMethod) return jsonError("กรุณาเลือกวิธีชำระเงิน");

  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  if (!pkg) return jsonError("ไม่พบแพ็กเกจที่ระบุ", 404);

  if (pkg.bookingType === null) {
    // Merch-only package: no table at all.
    try {
      const sale = await sellMerchPackage({
        packageId,
        cashierId: admin.adminId,
        paymentMethod,
        buyerName: bookerName || undefined,
        buyerPhone: bookerPhone || undefined,
        itemSizeSelections,
      });

      await logAdminAction({
        adminId: admin.adminId,
        action: "PACKAGE_SALE",
        targetType: "PosSale",
        targetId: sale.id,
        detail: `ขายแพ็กเกจของที่ระลึกหน้างาน รหัส ${sale.saleCode} ยอด ${sale.totalAmount} บาท (${paymentMethod})`,
      });

      return NextResponse.json({ sale }, { status: 201 });
    } catch (err) {
      if (err instanceof PackageMerchSaleError) {
        return jsonError(err.message);
      }
      throw err;
    }
  }

  if (!tableId) return jsonError("ต้องระบุโต๊ะที่ต้องการจอง");

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
      itemSizeSelections,
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
