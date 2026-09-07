import { Injectable, Logger, type OnModuleInit, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import type { AuthSession, AuthUser } from "@mikki-shop/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { TOKEN_TTL_SECONDS } from "./auth.constants";
import { type TelegramInitData, verifyInitData } from "./telegram-init-data";

/** Сколько ждём ответа Telegram при проверке токена на старте. */
const GET_ME_TIMEOUT_MS = 5_000;

/** Максимум имён полей в логе отказа — чтобы одним запросом не раздуть лог. */
const LOGGED_FIELDS_LIMIT = 20;

/**
 * Имена полей для лога: только то, что действительно похоже на имя поля.
 *
 * Имена приходят из тела запроса, то есть от кого угодно. Без чистки перевод
 * строки внутри имени дорисовывает в лог поддельную строку («2026-09-06 ERROR
 * …»), а тысяча выдуманных полей — строку на килобайты, и то и другое на
 * каждый запрос.
 */
function loggableFields(initData: string): string {
  const names = [...new URLSearchParams(initData).keys()]
    .map((name) => name.replace(/[^a-zA-Z0-9_]/g, "?").slice(0, 32))
    .sort();
  const shown = names.slice(0, LOGGED_FIELDS_LIMIT).join(", ");
  return names.length > LOGGED_FIELDS_LIMIT
    ? `${shown} и ещё ${names.length - LOGGED_FIELDS_LIMIT}`
    : shown;
}

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
export class AuthService implements OnModuleInit {
  private readonly log = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Проверка токена бота на старте.
   *
   * Токен, набранный с опечаткой или отозванный в BotFather, ничем не отличим
   * от подделки: `initData` приходит настоящий, а подпись не сходится, и в логе
   * лежит `bad-signature` — то есть ровно то же, что при попытке взлома. Так
   * этот токен и прожил целый вечер: приложение открывалось, каталог работал,
   * а покупатель молча оставался гостем. Один запрос `getMe` при запуске
   * отвечает на это прямо.
   *
   * Ничего не роняет: без сети (или с закрытым выходом наружу) проверить
   * нечем, а работать это не мешает — сама проверка подписи сети не требует.
   */
  async onModuleInit(): Promise<void> {
    const botToken = this.config.get<string>("TELEGRAM_BOT_TOKEN") ?? "";
    if (!botToken) return;

    try {
      // Таймаут обязателен: где выход наружу не отклоняют, а роняют пакеты
      // (типичная корпоративная сеть, да и облако с закрытым egress), `fetch`
      // висит до своих внутренних таймаутов — и вместе с ним висит старт
      // приложения, то есть проба готовности убивает контейнер из-за
      // диагностики, без которой оно прекрасно работает.
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
        signal: AbortSignal.timeout(GET_ME_TIMEOUT_MS),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        result?: { username?: string };
      };
      if (body.ok) {
        this.log.log(`Бот подключён: @${body.result?.username ?? "?"}`);
        return;
      }
      // 401 — токен не принят самим Telegram: опечатка при копировании или
      // токен отозван. Вход при этом не отключаем: решает всё равно подпись,
      // а нам важно, чтобы причина была названа вслух.
      this.log.error(
        `TELEGRAM_BOT_TOKEN отвергнут Telegram (${response.status}) — вход покупателей работать не будет`,
      );
    } catch {
      this.log.warn("Проверить TELEGRAM_BOT_TOKEN не удалось: Telegram недоступен");
    }
  }

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
      //
      // Вместе с причиной — **имена** пришедших полей, без значений. Причина
      // одна и та же («подпись не сошлась») и у чужого токена, и у нового поля,
      // которое клиент шлёт, а мы не учли, — а лечится это по-разному. Ровно
      // так и вышло с `signature` из Bot API 7.10: в логе был только
      // `bad-signature`. Значения не пишем: там профиль покупателя и сама
      // подпись, логу они не нужны.
      this.log.warn(`Вход отклонён: ${result.reason} (поля: ${loggableFields(initData)})`);
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
