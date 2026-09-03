import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import type { AuthSession, AuthUser } from "@mikki-shop/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { TOKEN_TTL_SECONDS } from "./auth.constants";
import { type TelegramInitData, verifyInitData } from "./telegram-init-data";

/** Что лежит в JWT. Ничего лишнего: остальное берётся из базы по `sub`. */
export interface JwtPayload {
  /** Наш `User.id`, не telegramId. */
  sub: string;
  telegramId: string;
}

/** Строка Prisma в том виде, в каком её читает `toAuthUser`. */
type UserRow = {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  isPremium: boolean;
};

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    telegramId: row.telegramId,
    ...(row.username ? { username: row.username } : {}),
    ...(row.firstName ? { firstName: row.firstName } : {}),
    ...(row.lastName ? { lastName: row.lastName } : {}),
    ...(row.photoUrl ? { photoUrl: row.photoUrl } : {}),
    isPremium: row.isPremium,
  };
}

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Вход по `initData` из Mini App.
   *
   * Регистрации в магазине нет: Telegram уже проверил, кто это, а мы проверяем
   * его подпись. Первый вход заводит покупателя, следующие обновляют профиль.
   */
  async login(initData: string): Promise<AuthSession> {
    const botToken = this.config.get<string>("TELEGRAM_BOT_TOKEN") ?? "";
    if (!botToken) {
      // Не 401: дело не в покупателе. Без токена проверить подпись нечем, и
      // тихо пускать всех подряд — худшее, что тут можно сделать.
      this.log.error("TELEGRAM_BOT_TOKEN не задан — вход через Telegram отключён");
      throw new UnauthorizedException("Вход через Telegram не настроен");
    }

    const result = verifyInitData(initData, botToken);
    if (!result.ok) {
      // Причина уходит в лог, а покупателю — один и тот же ответ: по разным
      // текстам ошибок подбирают подпись.
      this.log.warn(`Вход отклонён: ${result.reason}`);
      throw new UnauthorizedException("Не удалось подтвердить вход через Telegram");
    }

    const row = await this.upsert(result.data);
    return this.session(row);
  }

  /** Профиль по токену. Читается из базы, а не из JWT: имя могло поменяться. */
  async me(userId: string): Promise<AuthUser> {
    const row = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!row) throw new UnauthorizedException("Пользователь не найден");
    return toAuthUser(row);
  }

  private async upsert(data: TelegramInitData) {
    const { user, startParam } = data;
    const profile = {
      username: user.username ?? null,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      photoUrl: user.photoUrl ?? null,
      languageCode: user.languageCode ?? null,
      isPremium: user.isPremium,
      lastSeenAt: new Date(),
    };

    return this.prisma.user.upsert({
      where: { telegramId: user.id },
      // Источник перехода пишется только при создании: переход по чужой ссылке
      // не должен переписывать тот, что реально привёл покупателя.
      create: { telegramId: user.id, ...profile, utmSource: startParam ?? null },
      update: profile,
    });
  }

  private session(row: UserRow): AuthSession {
    const payload: JwtPayload = { sub: row.id, telegramId: row.telegramId };
    return {
      token: this.jwt.sign(payload),
      expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000,
      user: toAuthUser(row),
    };
  }
}
