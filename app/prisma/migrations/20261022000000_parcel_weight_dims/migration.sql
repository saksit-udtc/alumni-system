-- AlterTable
ALTER TABLE "MerchProduct" ADD COLUMN     "weightGrams" INTEGER,
ADD COLUMN     "lengthCm" INTEGER,
ADD COLUMN     "widthCm" INTEGER,
ADD COLUMN     "heightCm" INTEGER;

-- AlterTable
ALTER TABLE "MerchOrder" ADD COLUMN     "parcelWeightGrams" INTEGER,
ADD COLUMN     "parcelLengthCm" INTEGER,
ADD COLUMN     "parcelWidthCm" INTEGER,
ADD COLUMN     "parcelHeightCm" INTEGER,
ADD COLUMN     "parcelIncomplete" BOOLEAN NOT NULL DEFAULT false;
