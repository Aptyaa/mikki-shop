-- Профиль питомца: порода, размер и мерки. Всё необязательное — питомец
-- заводится и при оформлении заказа, где спрашивают только кличку.
ALTER TABLE "Pet" ADD COLUMN "breed" TEXT;
ALTER TABLE "Pet" ADD COLUMN "size" TEXT;
ALTER TABLE "Pet" ADD COLUMN "chestCm" INTEGER;
ALTER TABLE "Pet" ADD COLUMN "neckCm" INTEGER;
ALTER TABLE "Pet" ADD COLUMN "backCm" INTEGER;
ALTER TABLE "Pet" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Кличка в заказе становится слепком, как название и цена товара в строке.
-- Без неё профиль питомца переписывал бы историю: переименование меняло бы
-- кличку во всех прошлых заказах, а удаление обнуляло бы `petId` и теряло её.
ALTER TABLE "Order" ADD COLUMN "petName" TEXT;

-- Заполняем по текущей связи: у существующих заказов кличка ещё не менялась,
-- так что это ровно то, что было при оформлении.
UPDATE "Order" SET "petName" = "Pet"."name"
FROM "Pet"
WHERE "Order"."petId" = "Pet"."id";
