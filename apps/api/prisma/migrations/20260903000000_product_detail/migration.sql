-- Карточка товара: описание, состав, уход, рейтинг, фотографии,
-- а также размеры и расцветки отдельными таблицами.
--
-- `Product.sizes` (TEXT[]) удаляется: размеры переезжают в `ProductSize`, где у
-- каждого есть остаток и мерки. Данные из массива не переносятся — ассортимент
-- живёт в `prisma/seed.mjs`, продакшена ещё нет. Перед боевым запуском это
-- место придётся заменить на перенос: INSERT ... SELECT unnest("sizes").

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "sizes",
ADD COLUMN     "care" TEXT,
ADD COLUMN     "composition" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "photos" TEXT[],
ADD COLUMN     "rating" DOUBLE PRECISION,
ADD COLUMN     "reviewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ProductSize" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "chestCm" TEXT,
    "neckCm" TEXT,
    "backCm" TEXT,

    CONSTRAINT "ProductSize_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "ProductColor" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hex" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductColor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductSize_productId_idx" ON "ProductSize"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSize_productId_size_key" ON "ProductSize"("productId", "size");

-- CreateIndex
CREATE INDEX "ProductColor_productId_idx" ON "ProductColor"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductColor_productId_name_key" ON "ProductColor"("productId", "name");

-- AddForeignKey
ALTER TABLE "ProductSize" ADD CONSTRAINT "ProductSize_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductColor" ADD CONSTRAINT "ProductColor_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

