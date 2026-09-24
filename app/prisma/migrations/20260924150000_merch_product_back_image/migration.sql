-- AlterTable: MerchProduct gains an optional back-side photo, shown with the
-- existing cover image (front) as a ด้านหน้า/ด้านหลัง toggle on the shop's
-- product detail view.
ALTER TABLE "MerchProduct" ADD COLUMN     "backImageKey" TEXT;
