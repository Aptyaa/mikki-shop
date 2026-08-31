# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN apk add --no-cache openssl
RUN npm install -g pnpm@9.15.9
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN pnpm install --frozen-lockfile --filter api... --ignore-scripts

FROM deps AS build
COPY . .
RUN pnpm --filter shared-types build
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api build
RUN pnpm install --prod --frozen-lockfile --filter api... --ignore-scripts

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
RUN apk add --no-cache openssl
RUN addgroup -S app && adduser -S app -G app
WORKDIR /repo
COPY --from=build --chown=app:app /repo ./
USER app
WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
