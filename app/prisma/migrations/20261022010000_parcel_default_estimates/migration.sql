-- ค่าประมาณเริ่มต้นของข้อมูลพัสดุต่อชิ้น (น้ำหนักกรัม / ขนาดซม. ตอนบรรจุ) เพื่อให้ระบบรวมน้ำหนักพัสดุได้ก่อน
-- เติมเฉพาะสินค้าที่ยังไม่เคยกรอก (weightGrams IS NULL) — ไม่ทับค่าที่ admin กรอกแล้ว
-- ควรชั่ง/วัดของจริงแล้วแก้ที่หน้า /admin/merch/products

UPDATE "MerchProduct" SET "weightGrams" = 250, "lengthCm" = 30, "widthCm" = 25, "heightCm" = 3
WHERE "weightGrams" IS NULL AND "name" LIKE '%เสื้อ%' AND "name" LIKE '%คอปก%';

UPDATE "MerchProduct" SET "weightGrams" = 200, "lengthCm" = 30, "widthCm" = 25, "heightCm" = 3
WHERE "weightGrams" IS NULL AND "name" LIKE '%เสื้อ%' AND "name" LIKE '%คอกลม%';

UPDATE "MerchProduct" SET "weightGrams" = 450, "lengthCm" = 28, "widthCm" = 10, "heightCm" = 10
WHERE "weightGrams" IS NULL AND "name" LIKE '%แก้ว%';

UPDATE "MerchProduct" SET "weightGrams" = 250, "lengthCm" = 14, "widthCm" = 10, "heightCm" = 5
WHERE "weightGrams" IS NULL AND "name" LIKE '%เหรียญ%';
