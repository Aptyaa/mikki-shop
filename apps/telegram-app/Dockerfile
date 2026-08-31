# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.9
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/telegram-app/package.json apps/telegram-app/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile --filter telegram-app... --ignore-scripts

FROM deps AS build
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm --filter shared-types build
RUN pnpm --filter ui build
RUN pnpm --filter telegram-app build

FROM nginx:1.27-alpine AS runtime
COPY apps/telegram-app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/telegram-app/dist /usr/share/nginx/html
EXPOSE 80
