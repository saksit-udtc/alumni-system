import crypto from "crypto";
import { uploadObject, MERCH_PRODUCTS_BUCKET } from "@/lib/minio";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// Shared by the cover-image, gallery and size-guide upload routes so all
// three enforce the same type/size limits.
export function validateMerchImage(file: File | null): string | null {
  if (!file) return "กรุณาแนบไฟล์รูปสินค้า";
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    return "รองรับเฉพาะไฟล์ภาพ JPEG, PNG หรือ WEBP เท่านั้น";
  }
  if (file.size > MAX_SIZE_BYTES) return "ไฟล์ภาพต้องมีขนาดไม่เกิน 10MB";
  return null;
}

// Uploads into the public merch-products bucket under `<productId>/` and
// returns the stored object key.
export async function storeMerchImage(productId: string, file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const key = `${productId}/${crypto.randomUUID()}.${ext}`;
  await uploadObject(MERCH_PRODUCTS_BUCKET, key, buffer, file.type || "image/png");
  return key;
}
