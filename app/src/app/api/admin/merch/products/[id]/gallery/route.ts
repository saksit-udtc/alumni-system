import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/apiHelpers";
import { publicMerchProductUrl } from "@/lib/minio";
import { validateMerchImage, storeMerchImage } from "@/lib/merchImageUpload";

// Add one extra gallery photo to a product (shown after its cover image on
// the shop's detail view). Appended at the end of the current sort order.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { response } = requireAdmin(req, ["SUPER_ADMIN", "MERCH_STAFF"]);
  if (response) return response;

  const product = await prisma.merchProduct.findUnique({ where: { id: params.id } });
  if (!product) return jsonError("ไม่พบสินค้าที่ระบุ", 404);

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file") as File | null;
  const invalid = validateMerchImage(file);
  if (invalid) return jsonError(invalid);

  const count = await prisma.merchProductImage.count({ where: { productId: params.id } });
  if (count >= 10) return jsonError("เพิ่มรูปเสริมได้สูงสุด 10 รูปต่อสินค้า");

  const last = await prisma.merchProductImage.findFirst({
    where: { productId: params.id },
    orderBy: { sortOrder: "desc" },
  });
  const key = await storeMerchImage(params.id, file as File);
  const image = await prisma.merchProductImage.create({
    data: { productId: params.id, imageKey: key, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });

  return NextResponse.json({ image: { id: image.id, imageUrl: publicMerchProductUrl(image.imageKey) } });
}
