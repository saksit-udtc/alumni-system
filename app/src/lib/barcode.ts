import crypto from "crypto";
import { prisma } from "./prisma";

/**
 * Generates a short numeric barcode value, encodable as a Code128 barcode
 * and small enough to fit comfortably on a printed sticker label. Format:
 * "8" + 11 random digits (12 digits total) — the leading 8 keeps it
 * visually/structurally distinct from any real manufacturer EAN/UPC code
 * that might already be printed on the merchandise itself.
 */
function generateBarcodeValue(): string {
  const digits = crypto.randomInt(0, 1e11).toString().padStart(11, "0");
  return `8${digits}`;
}

export class BarcodeError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Ensures the given MerchProductStock row (one product+size variant) has a
 * barcode, generating and saving a fresh unique one if it doesn't have one
 * yet — or always generating a new one when `regenerate` is true (e.g. a
 * lost/damaged label needs reprinting with a fresh code).
 *
 * Retries on the rare collision against the @unique constraint on
 * MerchProductStock.barcode.
 */
export async function ensureStockBarcode(stockId: string, regenerate = false): Promise<string> {
  const stock = await prisma.merchProductStock.findUnique({ where: { id: stockId } });
  if (!stock) {
    throw new BarcodeError("STOCK_NOT_FOUND", "ไม่พบรายการสต๊อกนี้");
  }
  if (stock.barcode && !regenerate) return stock.barcode;

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateBarcodeValue();
    try {
      const updated = await prisma.merchProductStock.update({
        where: { id: stockId },
        data: { barcode: code },
      });
      return updated.barcode!;
    } catch (err: unknown) {
      // P2002 = unique constraint violation — extremely unlikely collision,
      // just try another random code.
      if ((err as { code?: string })?.code === "P2002") continue;
      throw err;
    }
  }
  throw new BarcodeError("BARCODE_GENERATION_FAILED", "สร้างบาร์โค้ดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
}
