# Mikki Shop

Интернет-магазин одежды для маленьких собак — Telegram Mini App (первая платформа), затем VK Mini App. Архитектура и роадмап: [ARCHITECTURE.md](ARCHITECTURE.md), [ROADMAP.md](ROADMAP.md). Правила работы над репозиторием (в т.ч. для нескольких параллельных сессий Claude Code) — [CLAUDE.md](CLAUDE.md).

## Стек

TS-монорепо на pnpm workspaces: NestJS + Prisma + PostgreSQL/PostGIS + Redis на бэке, React + Vite + Tailwind на фронте. Подробности — [ARCHITECTURE.md](ARCHITECTURE.md).

## Быстрый старт

Требуется: Node ≥22, pnpm, Docker.

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

## Открыть в Telegram

Приложение работает в браузере как гость — каталог, карточка и корзина
публичные. Чтобы заработал вход (и, дальше, заказы), нужен бот и публичный
адрес. Четыре шага, по порядку:

1. **Бот.** [@BotFather](https://t.me/BotFather) → `/newbot`. Полученный токен —
   в `.env`, поле `TELEGRAM_BOT_TOKEN`. В репозиторий он не попадёт: `.env` в
   `.gitignore`. Без токена вход выключен целиком (а не «пускает всех»).
2. **Публичный HTTPS.** Telegram открывает Mini App только по HTTPS, локальный
   адрес не подойдёт. Задеплойте `apps/telegram-app` куда угодно с сертификатом
   и укажите этой сборке боевой `VITE_API_URL`.
3. **Привязка.** @BotFather → `/setmenubutton` (или Bot Settings → Menu Button)
   → адрес приложения из шага 2.
4. **Куда слать заказы.** Свой chat id (например, у
   [@userinfobot](https://t.me/userinfobot)) — в `.env`, поле `MANAGER_CHAT_ID`.
   Пока оно пустое, заказы оформляются, но заявки о них пишутся только в лог
   сервера, то есть их никто не увидит.

После этого при открытии Mini App покупатель входит молча: клиент передаёт
`initData`, бэкенд проверяет его подпись токеном бота и выдаёт JWT.
Подробности и что осталось непроверенным — `docs/features/008-telegram-auth.md`
и `docs/features/009-checkout.md`.

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
