-- Профиль покупателя из Telegram `initData` и источник перехода из deep-link.
-- Всё необязательное: `initData` не обещает ни username, ни фамилию, ни фото.


-- AlterTable
ALTER TABLE "User" ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "isPremium" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "languageCode" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "username" TEXT,
ADD COLUMN     "utmSource" TEXT;

