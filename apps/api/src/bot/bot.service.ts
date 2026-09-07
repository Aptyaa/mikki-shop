import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OrdersService } from "../orders/orders.service";
import { format } from "../orders/manager-notifier";
import { STATUS_LABEL, parseCallback, statusKeyboard } from "../orders/order-status";
import { TelegramApi } from "./telegram-api";

/** Сколько секунд Telegram держит `getUpdates` открытым, если обновлений нет. */
const POLL_SECONDS = 30;

/** Запас к таймауту запроса поверх long polling: ответ должен успеть дойти. */
const POLL_SLACK_MS = 5_000;

/** Пауза после отказа Bot API — чтобы не долбить его в цикле без передышки. */
const RETRY_DELAY_MS = 5_000;

/** Обновления, которые бот разбирает. Остальные Telegram нам просто не пришлёт. */
const ALLOWED_UPDATES = ["message", "callback_query"];

/** Минимум полей Bot API, которые бот читает. Клиента Bot API в проекте нет. */
interface Update {
  update_id: number;
  message?: { chat?: { id?: number }; from?: { id?: number }; text?: string };
  callback_query?: {
    id: string;
    data?: string;
    from?: { id?: number };
    message?: { chat?: { id?: number }; message_id?: number; text?: string };
  };
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Бот: `/start` покупателю и кнопки статусов менеджеру.
 *
 * **Long polling, а не webhook** — намеренно. Webhook требует публичного
 * HTTPS-адреса, то есть деплоя, которого у проекта ещё нет: сегодня адрес
 * живёт, пока работает туннель разработчика (`docs/features/014-public-https.md`),
 * и меняется при перезапуске. `getUpdates` ходит наружу сам и работает
 * откуда угодно, включая ноутбук. Появится постоянный адрес — меняется ровно
 * этот класс, всё остальное (статусы, тексты, клавиатуры) от способа доставки
 * обновлений не зависит.
 *
 * Обратная сторона у этого одна и важная: **экземпляр должен быть один**.
 * Два процесса с одним токеном разбирают очередь обновлений наперегонки, и
 * половина нажатий уходит в никуда. Поэтому при масштабировании API в
 * несколько реплик бот переезжает на webhook или в отдельный процесс.
 */
@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(BotService.name);
  /** `update_id` следующего непрочитанного обновления. */
  private offset = 0;
  private running = false;

  constructor(
    private readonly telegram: TelegramApi,
    private readonly orders: OrdersService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (!this.telegram.enabled) {
      this.log.log("Бот выключен: TELEGRAM_BOT_TOKEN не задан");
      return;
    }
    if (this.config.get<string>("BOT_POLLING") === "off") {
      this.log.log("Опрос обновлений выключен: BOT_POLLING=off");
      return;
    }
    const managers = this.managerIds();
    if (managers.length === 0) {
      // Кнопки при этом остаются под заявкой, но нажать их будет некому:
      // без списка менеджеров любое нажатие — чужое.
      this.log.warn(
        "MANAGER_CHAT_ID не задан: статусы заказов менять будет некому — кнопки не примут нажатие",
      );
    } else if (managers.every((id) => id.startsWith("-"))) {
      // У группы id отрицательный, и он не совпадает ни с одним человеком, а
      // нажатие проверяется по тому, кто нажал. Молча это выглядит как «кнопки
      // сломались»: заявки приходят, а статус не меняется ни у кого.
      this.log.warn(
        "Заявки идут в группу, а нажатия проверяются по id нажавшего: перечислите менеджеров в ADMIN_TELEGRAM_IDS, иначе кнопки не примут никого",
      );
    }

    this.running = true;
    // Без `await`: старт приложения не должен ждать Telegram. `catch`
    // обязателен — необработанный rejection под Node 22 роняет процесс.
    void this.poll().catch((error: unknown) =>
      this.log.error(`Опрос обновлений остановлен: ${String(error)}`),
    );
  }

  onModuleDestroy(): void {
    this.running = false;
  }

  /** Цикл опроса. Из него не выходят по ошибке — только по остановке приложения. */
  private async poll(): Promise<void> {
    this.log.log("Опрос обновлений запущен");
    while (this.running) {
      const updates = await this.telegram.call<Update[]>(
        "getUpdates",
        { offset: this.offset, timeout: POLL_SECONDS, allowed_updates: ALLOWED_UPDATES },
        POLL_SECONDS * 1000 + POLL_SLACK_MS,
      );

      if (!updates) {
        await delay(RETRY_DELAY_MS);
        continue;
      }

      for (const update of updates) {
        // Сдвиг до обработки: обновление, на котором мы падаем, иначе
        // приезжало бы снова и снова, и бот не двигался бы дальше.
        this.offset = update.update_id + 1;
        try {
          await this.handleUpdate(update);
        } catch (error) {
          this.log.error(`Обновление ${update.update_id} не обработано: ${String(error)}`);
        }
      }
    }
  }

  /** Разбор одного обновления. Публичный ради тестов: цикл опроса проверять нечем. */
  async handleUpdate(update: Update): Promise<void> {
    if (update.callback_query) {
      await this.handleCallback(update.callback_query);
      return;
    }

    const text = update.message?.text?.trim() ?? "";
    const chatId = update.message?.chat?.id;
    // `/start` приходит и с полезной нагрузкой (`/start utm_tiktok`), и с
    // именем бота в группе (`/start@MikkiBot`) — команда здесь начало строки,
    // а не вся она.
    if (chatId !== undefined && /^\/start(@\S+)?(\s|$)/.test(text)) {
      await this.sendGreeting(chatId, update.message?.from?.id);
    }
  }

  /** Приветствие и кнопка, открывающая Mini App. */
  private async sendGreeting(chatId: number, fromId?: number): Promise<void> {
    const url = this.config.get<string>("WEBAPP_URL") ?? "";
    // Кнопка `web_app` живёт только в личном чате (id положительный) и только
    // с HTTPS-адресом. Оба отказа Telegram отдаёт на весь `sendMessage`, а не
    // на кнопку: в группе или с недонастроенным адресом собеседник не получил
    // бы даже приветствия. Поэтому кнопка появляется, только когда она заведомо
    // пройдёт.
    const button =
      url.startsWith("https://") && chatId > 0
        ? { inline_keyboard: [[{ text: "Открыть магазин", web_app: { url } }]] }
        : undefined;

    const lines = [
      "Микки Шоп — одежда для маленьких собак.",
      button
        ? "Каталог, размеры и заказ — по кнопке ниже."
        : "Каталог открывается кнопкой меню бота.",
    ];
    if (fromId !== undefined && this.isManager(String(fromId))) {
      lines.push("", "Заявки на заказы приходят сюда — статус меняется кнопками под заявкой.");
    }

    await this.telegram.call("sendMessage", {
      chat_id: chatId,
      text: lines.join("\n"),
      ...(button ? { reply_markup: button } : {}),
    });
  }

  /**
   * Нажатие кнопки статуса.
   *
   * На нажатие отвечают всегда — иначе кнопка в клиенте крутится до таймаута,
   * и менеджер жмёт её второй раз, думая, что не попал.
   */
  private async handleCallback(query: NonNullable<Update["callback_query"]>): Promise<void> {
    const answer = (text: string): Promise<unknown> =>
      this.telegram.call("answerCallbackQuery", { callback_query_id: query.id, text });

    // `callback_data` приходит от клиента Telegram, то есть от кого угодно, кто
    // дотянулся до кнопки: пересланное сообщение с кнопками нажимается любым
    // получателем. Право менять статус проверяется по тому, кто нажал, а не по
    // тому, что нажали.
    const fromId = query.from?.id;
    if (fromId === undefined || !this.isManager(String(fromId))) {
      this.log.warn(`Чужое нажатие кнопки статуса: from=${String(fromId)}`);
      await answer("Это кнопка менеджера");
      return;
    }

    const parsed = parseCallback(query.data ?? "");
    if (!parsed) {
      await answer("Кнопка устарела");
      return;
    }

    const result = await this.orders.setStatus(parsed.number, parsed.status);
    if (!result.ok) {
      await answer(
        result.reason === "not-found"
          ? `Заказ ${parsed.number} не найден`
          : `Заказ ${parsed.number}: из текущего статуса так нельзя`,
      );
      return;
    }

    await answer(`Заказ ${parsed.number}: ${STATUS_LABEL[result.order.status]}`);

    // Правим ту самую заявку, под которой нажали: статус в её последней строке
    // и набор кнопок должны показывать, что с заказом сейчас, а не историю
    // нажатий. Сообщения нет (слишком старое для правки) — статус всё равно
    // изменён, это не повод считать нажатие неудавшимся.
    const chatId = query.message?.chat?.id;
    const messageId = query.message?.message_id;
    if (chatId === undefined || messageId === undefined) return;

    // Нажали то, что уже стоит (старая заявка со старыми кнопками): текст и
    // клавиатура совпали бы с тем, что в чате, а Telegram отвергает правку,
    // ничего не меняющую («message is not modified»), — то есть в лог легла бы
    // ошибка на пути, который сам код считает нормальным.
    const text = format(result.order);
    if (query.message?.text === text) return;

    await this.telegram.call("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      // `undefined` не уедет в JSON вовсе — и Telegram уберёт кнопки, когда
      // путь заказа закончился.
      reply_markup: statusKeyboard(result.order.number, result.order.status),
    });
  }

  /**
   * Кому можно менять статусы.
   *
   * По умолчанию — тот, кому приходят заявки (`MANAGER_CHAT_ID`). Отдельный
   * `ADMIN_TELEGRAM_IDS` нужен, когда менеджеров несколько или заявки идут в
   * группу, у которой свой id, не совпадающий ни с одним человеком.
   * Пусто — не может никто: это безопасный отказ, а не «можно всем».
   */
  private managerIds(): string[] {
    const raw =
      this.config.get<string>("ADMIN_TELEGRAM_IDS") ||
      this.config.get<string>("MANAGER_CHAT_ID") ||
      "";
    return raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }

  private isManager(id: string): boolean {
    return this.managerIds().includes(id);
  }
}
