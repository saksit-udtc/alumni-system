-- ล็อกโต๊ะ: แอดมินล็อกโต๊ะไม่ให้ใครกดจองได้ (ไม่เกี่ยวกับรายการจอง)
ALTER TABLE "Table" ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false;
