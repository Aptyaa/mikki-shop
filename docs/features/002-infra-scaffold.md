# 002 — Инфраструктурный скелет монорепо

Статус: **done** (скелет; реальные ресурсы в облаке не подняты)

## Что сделано
- pnpm workspace: `apps/api`, `apps/telegram-app`, `packages/shared-types`, `packages/ui`.
- `apps/api` — NestJS, Prisma подключена, `schema.prisma` уже объявляет `datasource` с расширением `postgis` и модель `User`.
- `docker-compose.yml` — postgres (образ `postgis/postgis`), redis, api, telegram-app, все сервисы билдятся из Dockerfile'ов приложений.
- `.env.example`, `.gitignore` (уже исключает `node_modules/`, `dist/`, `.env`).
- Оба билда (`pnpm --filter api build`, `pnpm --filter telegram-app build`) проходят чисто.

## Не сделано
- Реальный облачный хостинг (Yandex Cloud/Selectel) не настроен — сейчас только локальный docker-compose.
- CI/CD (GitHub Actions → Container Registry) не заведён.
- `packages/shared-types` — пустой пакет, DTO ещё не описаны.

## Связано с
[[001-catalog-screen]] — каталог пока работает на статичных данных, следующий шаг обеих фич — завести `GET /catalog` в `apps/api` и подключить.
