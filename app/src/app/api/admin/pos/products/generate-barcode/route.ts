import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { ensureStockBarcode, BarcodeError } from "@/lib/barcode";
import { logAdminAction } from "@/lib/auditLog";

/**
 * Generates (or, with regenerate:true, replaces) the printed barcode for
 * one MerchProductStock row. Called from the "จัดการสินค้า/สต๊อก" admin
 * page next to each size/variant, and again from the label-printing page
 * for any row a staff member picks to (re)print.
 */
export async function POST(req: NextRequest) {
  const { admin, response } = requireAdmin(req, ["MERCH_STAFF"]);
  if (!admin) return response;

  const body = await req.json().catch(() => null);
  const stockId = body?.stockId;
  const regenerate = !!body?.regenerate;
  if (!stockId || typeof stockId !== "string") {
    return jsonError("MISSING_STOCK_ID");
  }

  try {
    const barcode = await ensureStockBarcode(stockId, regenerate);
    await logAdminAction({
      adminId: admin.adminId,
      action: regenerate ? "MERCH_STOCK_BARCODE_REGENERATE" : "MERCH_STOCK_BARCODE_GENERATE",
      targetType: "MerchProductStock",
      targetId: stockId,
      detail: barcode,
    });
    return NextResponse.json({ barcode });
  } catch (err) {
    if (err instanceof BarcodeError) {
      return jsonError(err.message, err.code === "STOCK_NOT_FOUND" ? 404 : 400);
    }
    console.error("generate-barcode failed", err);
    return jsonError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง", 500);
  }
}
