-- Data migration: shirt sizes switch to the manufacturer's (BCS Sport) size
-- chart — SS, S, M, L, XL, 3L, 4L, 6L, 8L (was S, M, L, XL, 2XL, 3XL, 4XL, 5XL).
-- Existing rows are renamed by matching chest measurement:
--   2XL (46") -> 3L, 3XL (48") -> 4L, 5XL (52") -> 6L
-- S/M/L/XL keep their names. 4XL (50") has no equivalent in the new chart and
-- is left unchanged for an admin to review by hand.
-- No "3L"/"4L"/"6L" rows existed before this change, so the
-- @@unique([productId, size]) constraint on MerchProductStock cannot collide.

UPDATE "MerchProductStock" SET "size" = '3L' WHERE "size" = '2XL';
UPDATE "MerchProductStock" SET "size" = '4L' WHERE "size" = '3XL';
UPDATE "MerchProductStock" SET "size" = '6L' WHERE "size" = '5XL';

UPDATE "MerchOrderItem" SET "size" = '3L' WHERE "size" = '2XL';
UPDATE "MerchOrderItem" SET "size" = '4L' WHERE "size" = '3XL';
UPDATE "MerchOrderItem" SET "size" = '6L' WHERE "size" = '5XL';

UPDATE "PosSaleItem" SET "size" = '3L' WHERE "size" = '2XL';
UPDATE "PosSaleItem" SET "size" = '4L' WHERE "size" = '3XL';
UPDATE "PosSaleItem" SET "size" = '6L' WHERE "size" = '5XL';

UPDATE "PackageItem" SET "size" = '3L' WHERE "size" = '2XL';
UPDATE "PackageItem" SET "size" = '4L' WHERE "size" = '3XL';
UPDATE "PackageItem" SET "size" = '6L' WHERE "size" = '5XL';

UPDATE "ReservationPackageItem" SET "size" = '3L' WHERE "size" = '2XL';
UPDATE "ReservationPackageItem" SET "size" = '4L' WHERE "size" = '3XL';
UPDATE "ReservationPackageItem" SET "size" = '6L' WHERE "size" = '5XL';
