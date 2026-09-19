-- Admin-controlled display order for the shop grid (lower = earlier; ties
-- fall back to createdAt).

-- AlterTable
ALTER TABLE "MerchProduct" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Initial order requested for the homecoming shop: collared shirt, round-neck
-- shirt, cup, Vishnu coin. Any other product goes after these (admin can
-- reorder with the up/down buttons on the product admin page).
UPDATE "MerchProduct" SET "sortOrder" = CASE "name"
    WHEN 'เสื้อที่ระลึก(คอปก)' THEN 1
    WHEN 'เสื้อที่ระลึก(คอกลม)' THEN 2
    WHEN 'แก้วเยติ' THEN 3
    WHEN 'แก้วน้ำที่ระลึก' THEN 3
    WHEN 'เหรียญพระวิษณุ' THEN 4
    ELSE 100
END;
