import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { IS_PUBLIC } from "./auth.constants";
import type { JwtPayload } from "./auth.service";

/**
 * Проверка `Authorization: Bearer <jwt>`.
 *
 * Включён глобально: закрыто по умолчанию, открыто декоратором `@Public()`.
 * Так забытый декоратор даёт 401 на публичной ручке — это видно сразу, в
 * отличие от забытой защиты на закрытой.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const token = bearerOf(request.headers.authorization);

    // На публичном маршруте токен разбирается, но не требуется: каталог всем
    // отдаёт одно и то же, а вот кто его смотрит — знать полезно, и `@Public()`
    // не должен этого лишать.
    if (isPublic) {
      if (token) {
        const payload = this.tryVerify(token);
        if (payload) request.user = payload;
      }
      return true;
    }

    if (!token) throw new UnauthorizedException("Нужен вход через Telegram");

    const payload = this.tryVerify(token);
    if (!payload) throw new UnauthorizedException("Сессия истекла, войдите заново");

    request.user = payload;
    return true;
  }

  private tryVerify(token: string): JwtPayload | null {
    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      // Токен подписан нами, но полезная нагрузка могла остаться от прошлой
      // версии формата — без `sub` он бесполезен.
      return typeof payload?.sub === "string" && payload.sub ? payload : null;
    } catch {
      return null;
    }
  }
}

/** Токен из заголовка. Схема сверяется без учёта регистра, как требует RFC. */
function bearerOf(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (!scheme || !value) return null;
  return scheme.toLowerCase() === "bearer" && value.trim() ? value.trim() : null;
}
