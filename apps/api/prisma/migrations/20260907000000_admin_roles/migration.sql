-- Роли: покупатель, менеджер, владелец. До сих пор менеджеры перечислялись в
-- `.env`, то есть добавить человека можно было только правкой файла и
-- перезапуском API.
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN', 'OWNER');

ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER';

CREATE INDEX "User_role_idx" ON "User"("role");

-- Приглашение в менеджеры — одноразовая ссылка `t.me/бот?start=admin_<код>`.
-- По @username человека в Telegram не найти: Bot API не отдаёт id по имени.
-- Ссылка решает это сама — приглашённый жмёт её, и бот узнаёт его id.
CREATE TABLE "AdminInvite" (
    "id" TEXT NOT NULL,
    -- SHA-256 кода, а не сам код: ссылку видят мессенджер, пересылки и бэкапы.
    "codeHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminInvite_codeHash_key" ON "AdminInvite"("codeHash");

CREATE INDEX "AdminInvite_createdById_idx" ON "AdminInvite"("createdById");

ALTER TABLE "AdminInvite" ADD CONSTRAINT "AdminInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Приглашение переживает удаление того, кто им воспользовался: запись о том,
-- что доступ выдавали, — это журнал, и терять его вместе с пользователем
-- незачем.
ALTER TABLE "AdminInvite" ADD CONSTRAINT "AdminInvite_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
