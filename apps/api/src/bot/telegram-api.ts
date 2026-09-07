import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/** Сколько ждём обычный вызов Bot API. Long polling просит таймаут отдельно. */
const CALL_TIMEOUT_MS = 10_000;

/** Сколько тела ответа писать в лог, когда вместо JSON приехало что-то другое. */
const LOGGED_BODY_LIMIT = 200;

/**
 * Тонкий клиент Bot API: один `fetch`, свой таймаут и разбор конверта Telegram.
 *
 * Библиотеки бота (`telegraf`, `grammy`) не взяты: из бота нужны три метода —
 * `sendMessage`, `editMessageText`, `answerCallbackQuery` — и `getUpdates`.
 * Это меньше кода, чем весит любая из них, а `fetch` в Node 22 встроенный.
 *
 * Ошибку наружу не бросает: и заявка менеджеру, и сообщение покупателю, и
 * ответ на нажатие — вещи, ради которых нельзя ронять ни заказ, ни цикл
 * опроса. Не получилось — `null` и строка в логе.
 */
@Injectable()
export class TelegramApi {
  private readonly log = new Logger(TelegramApi.name);

  constructor(private readonly config: ConfigService) {}

  private get token(): string {
    return this.config.get<string>("TELEGRAM_BOT_TOKEN") ?? "";
  }

  /** Есть ли чем ходить в Telegram. Без токена бот выключен целиком, а не «пускает всех». */
  get enabled(): boolean {
    return this.token !== "";
  }

  async call<T>(
    method: string,
    payload: Record<string, unknown>,
    timeoutMs: number = CALL_TIMEOUT_MS,
  ): Promise<T | null> {
    const token = this.token;
    if (!token) return null;

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        // Таймаут обязателен: в сети, которая дропает пакеты вместо отказа,
        // `fetch` висит до своих внутренних таймаутов и вешает вместе с собой
        // цикл опроса — бот молчит, а в логе ничего.
        signal: AbortSignal.timeout(timeoutMs),
      });

      // Сначала текстом: у прокси и заглушек ответ бывает не JSON, и
      // `response.json()` тогда бросает, унося с собой HTTP-код — то есть
      // единственное, по чему разбираться.
      const raw = await response.text();
      let body: { ok?: boolean; result?: T; description?: string };
      try {
        body = JSON.parse(raw) as typeof body;
      } catch {
        this.log.error(
          `${method}: HTTP ${response.status}, ответ не JSON: ${raw.slice(0, LOGGED_BODY_LIMIT)}`,
        );
        return null;
      }

      if (!body.ok) {
        // Описание отказа от Telegram («chat not found», «bot was blocked by
        // the user») — без него разбираться не в чем.
        this.log.error(`${method}: HTTP ${response.status} ${body.description ?? ""}`);
        return null;
      }
      return body.result ?? null;
    } catch (error) {
      this.log.error(`${method}: ${String(error)}`);
      return null;
    }
  }
}
