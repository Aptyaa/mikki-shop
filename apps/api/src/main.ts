import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Mini App отдаётся с другого origin, чем API (в дев-режиме Vite на :5173,
  // в проде — nginx/домен Telegram), поэтому CORS нужен всегда.
  // CORS_ORIGIN не задан — открыто: каталог публичный и read-only.
  // filter(Boolean) обязателен: CORS_ORIGIN="" иначе даёт [""] — массив длиной 1,
  // то есть вайтлист, не совпадающий ни с одним origin, и каталог молча умирает.
  const origin = process.env.CORS_ORIGIN?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  app.enableCors({ origin: origin?.length ? origin : true });
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap();
