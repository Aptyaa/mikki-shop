# 002 — Инфраструктурный скелет монорепо

Статус: **done**, скелет полностью проверен вживую локально (2026-08-31); реальные ресурсы в облаке не подняты

## Что сделано
- pnpm workspace: `apps/api`, `apps/telegram-app`, `packages/shared-types`, `packages/ui`.
- `apps/api` — NestJS, Prisma подключена, `schema.prisma` уже объявляет `datasource` с расширением `postgis` и модель `User`.
- `docker-compose.yml` — postgres (образ `postgis/postgis`), redis, api, telegram-app, все сервисы билдятся из Dockerfile'ов приложений.
- `.env.example`, `.gitignore` (уже исключает `node_modules/`, `dist/`, `.env`).
- Оба билда (`pnpm --filter api build`, `pnpm --filter telegram-app build`) проходят чисто.

## Исправлено при доведении Фазы 0 (2026-08-31)
Скелет собирался, но никогда не запускался на реальной БД — при первом реальном прогоне всплыло несколько багов:

- **`.env` был непригоден ни для чего.** `DATABASE_URL`/`REDIS_URL` указывали на хостнеймы `postgres`/`redis` — они резолвятся только *внутри* docker-сети, не с хоста. Локальный `pnpm --filter api dev`/`migrate` не мог достучаться до БД в принципе. Исправлено: `.env` теперь настроен на `127.0.0.1` (для локального запуска), а `docker-compose.yml` для сервиса `api` получил блок `environment`, который переопределяет `DATABASE_URL`/`REDIS_URL`/`PORT` на хостнеймы сервисов — единый `.env` корректно обслуживает оба сценария.
- **Ни Prisma CLI, ни `ConfigModule` не видели корневой `.env`.** Оба по умолчанию ищут `.env` в cwd (`apps/api/`), а не в корне монорепо. Исправлено: добавлен `dotenv-cli`, скрипты `dev`/`migrate` в `apps/api/package.json` явно грузят `../../.env`. `start` (используется только внутри Docker) не тронут — там переменные приходят из compose напрямую.
- **Конфликты портов с посторонними процессами на этой машине**: нативный (не Docker) Postgres уже занимал `5432`, чужой Docker-контейнер (`prakticum-client`) — `3000`. Исправлено переносом на `5433`/`3001` (см. `README.md`, таблица портов) — не факт, что актуально на других машинах, но исходить стоит из того, что порт может быть занят.
- **`localhost` не резолвится в IPv6-loopback на этой машине** (та же природа, что и баг с Vite dev-сервером из `001-catalog-screen.md`) — везде, где раньше стоял `localhost`, теперь `127.0.0.1`.
- Первая Prisma-миграция не существовала. `prisma migrate dev` требует интерактивный TTY, которого нет в среде агента — сгенерировал SQL через `prisma migrate diff --script` и применил через `prisma migrate deploy` (non-interactive-safe команда). Расширение `postgis` подтверждено реально активным в БД (`SELECT postgis_version()`), не только объявленным в `schema.prisma`.
- `GET /health` проверен end-to-end на живом NestJS + Postgres + Redis.
- Добавлен `.github/workflows/ci.yml` (lint + typecheck + build на push/PR) и корневой `README.md` с шагами локального запуска.

## Не сделано
- Реальный облачный хостинг (Yandex Cloud/Selectel) не настроен — сейчас только локальный docker-compose.
- CI ещё не запускался на самом GitHub — нет remote-репозитория, чтобы это проверить.
- `packages/shared-types` — почти пустой пакет (только `HealthStatus`), остальные DTO ещё не описаны.

## Связано с
[[001-catalog-screen]] — каталог пока работает на статичных данных, следующий шаг обеих фич — завести `GET /catalog` в `apps/api` и подключить.
