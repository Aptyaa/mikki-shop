# Mikki Shop

Интернет-магазин одежды для маленьких собак — Telegram Mini App (первая платформа), затем VK Mini App. Архитектура и роадмап: [ARCHITECTURE.md](ARCHITECTURE.md), [ROADMAP.md](ROADMAP.md). Правила работы над репозиторием (в т.ч. для нескольких параллельных сессий Claude Code) — [CLAUDE.md](CLAUDE.md).

## Стек

TS-монорепо на pnpm workspaces: NestJS + Prisma + PostgreSQL/PostGIS + Redis на бэке, React + Vite + Tailwind на фронте. Подробности — [ARCHITECTURE.md](ARCHITECTURE.md).

## Быстрый старт

Требуется: Node ≥20, pnpm, Docker.

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres redis
pnpm --filter api migrate      # применяет миграции к локальной БД
pnpm --filter api dev          # http://127.0.0.1:3001 (порт см. .env)
pnpm --filter telegram-app dev # http://127.0.0.1:5173
```

Открывайте `127.0.0.1`, а не `localhost` — на части машин `localhost` резолвится в нерабочий IPv6-loopback, из-за чего dev-серверы становятся недоступны в браузере при полностью рабочем процессе.

## Порты по умолчанию

Отличаются от общепринятых (`5432`, `3000`) — на машине, где собирался этот скелет, они были заняты сторонними сервисами. Если у вас 5432/3000 свободны, можно вернуть их в `.env` и `docker-compose.yml`, но исходите из того, что порт может быть занят чем-то ещё.

| Сервис | Порт |
|---|---|
| telegram-app (Vite) | 5173 |
| api (NestJS) | 3001 (внутри Docker — 3000) |
| postgres | 5433 (внутри Docker — 5432) |
| redis | 6379 |

## Полезные команды (из корня)

```bash
pnpm run build       # собрать все пакеты/приложения
pnpm run typecheck   # tsc --noEmit по всем пакетам
pnpm run lint        # oxlint по дизайн-контракту (packages/ui, apps/telegram-app)
pnpm run test        # Vitest по всему монорепо (без БД и без браузера)
pnpm run test:watch  # то же в watch-режиме
pnpm --filter api migrate   # прогнать новые Prisma-миграции
```

## Структура

```
apps/
  telegram-app/   Telegram Mini App (React + Vite)
  api/            NestJS API
packages/
  shared-types/   общие DTO/типы
  ui/             дизайн-система (компоненты, токены)
docs/features/    статус по фичам — см. CLAUDE.md
```
