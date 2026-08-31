import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { getMerchShippingFee, setMerchShippingFee } from "@/lib/settings";

// Admin: view/update the merch shipping fee shown at checkout and added to
// every new order's total. Same roles as the rest of merch product
// management — MERCH_STAFF handles day-to-day product/stock upkeep and
// this fee lives right alongside it in "จัดการสินค้า".
export async function GET(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF"]);
  if (response) return response;

  const shippingFee = await getMerchShippingFee();
  return NextResponse.json({ shippingFee });
}

export async function PUT(req: NextRequest) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF"]);
  if (response) return response;

  const body = await req.json().catch(() => null);
  if (!body) return jsonError("invalid body");

  const fee = Number(body.shippingFee);
  if (!Number.isFinite(fee) || fee < 0) {
    return jsonError("กรุณากรอกค่าจัดส่งเป็นตัวเลขที่มากกว่าหรือเท่ากับ 0");
  }

  await setMerchShippingFee(fee);
  return NextResponse.json({ ok: true, shippingFee: fee });
}
