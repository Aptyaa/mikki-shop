import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AdminsService, type AdminList } from "../admins/admins.service";
import { INVITE_PREFIX } from "../admins/admins.constants";
import { inviteCodeFromPayload, inviteLink } from "../admins/invite-code";
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

/** Сколько ждём подтверждение разобранного при остановке. Запрос мгновенный. */
const ACK_TIMEOUT_MS = 5_000;

/** Обновления, которые бот разбирает. Остальные Telegram нам просто не пришлёт. */
const ALLOWED_UPDATES = ["message", "callback_query"];

/** Минимум полей Bot API, которые бот читает. Клиента Bot API в проекте нет. */
interface Update {
  update_id: number;
  message?: { chat?: { id?: number }; from?: TelegramUser; text?: string };
  callback_query?: {
    id: string;
    data?: string;
    from?: TelegramUser;
    message?: { chat?: { id?: number }; message_id?: number; text?: string };
  };
}

interface TelegramUser {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

/** Пауза, которую прерывает остановка: иначе выключение ждало бы её целиком. */
const delay = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

/**
 * Разбор команды.
 *
 * Команда — начало строки, а не вся она: `/start` приходит и с полезной
 * нагрузкой (`/start admin_xxx`), и с именем бота в группе (`/start@Бот`).
 */
export function parseCommand(text: string): { command: string; payload: string } | null {
  const match = /^\/([a-zA-Z_]{1,32})(?:@\S+)?(?:\s+([\s\S]*))?$/.exec(text.trim());
  if (!match?.[1]) return null;
  return { command: match[1].toLowerCase(), payload: (match[2] ?? "").trim() };
}

/** Список менеджеров для владельца: текст и кнопки «убрать» напротив каждого. */
export function formatAdmins(list: AdminList): {
  text: string;
  reply_markup?: { inline_keyboard: { text: string; callback_data: string }[][] };
} {
  const name = (entry: AdminList["invited"][number]): string =>
    entry.firstName ?? (entry.username ? `@${entry.username}` : entry.telegramId);

  const lines = ["Доступ к заявкам:"];
  for (const entry of list.invited) {
    lines.push(
      `• ${name(entry)}${entry.username && entry.firstName ? ` (@${entry.username})` : ""}` +
        ` — ${entry.role === "OWNER" ? "владелец" : "менеджер"}`,
    );
  }
  if (list.fromEnv.length > 0) {
    // Их кнопкой не убрать, и молчать об этом нельзя: владелец решил бы, что
    // список полный.
    lines.push("", `Из .env (снимаются только правкой файла): ${list.fromEnv.join(", ")}`);
  }
  lines.push("", "Пригласить нового — /invite");

  const buttons = list.invited
    .filter((entry) => entry.role === "ADMIN")
    .map((entry) => [
      { text: `Убрать: ${name(entry)}`, callback_data: `admin:revoke:${entry.userId}` },
    ]);

  return {
    text: lines.join("\n"),
    ...(buttons.length > 0 ? { reply_markup: { inline_keyboard: buttons } } : {}),
  };
}

/**
 * Бот: `/start`, приглашение менеджеров и кнопки статусов под заявкой.
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
  /** Обрывает висящий `getUpdates` при остановке. */
  private readonly stopping = new AbortController();
  /** Сам цикл — чтобы дождаться его завершения при остановке. */
  private loop: Promise<void> = Promise.resolve();
  /** Имя бота для ссылок-приглашений. Спрашивается у Telegram один раз. */
  private username = "";

  constructor(
    private readonly telegram: TelegramApi,
    private readonly orders: OrdersService,
    private readonly admins: AdminsService,
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

    this.running = true;
    // Без `await`: старт приложения не должен ждать Telegram. `catch`
    // обязателен — необработанный rejection под Node 22 роняет процесс.
    this.loop = this.poll().catch((error: unknown) =>
      this.log.error(`Опрос обновлений остановлен: ${String(error)}`),
    );
  }

  /**
   * Остановка ждёт цикл, а не просто просит его закончиться.
   *
   * Разобранное подтверждается Telegram только следующим запросом с новым
   * `offset`, и без этого ожидания его не будет: та же пачка приедет заново к
   * заменяющему контейнеру, и `/invite` из неё выпишет второе живое
   * приглашение, а `/start` поздоровается дважды.
   */
  async onModuleDestroy(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    this.stopping.abort();
    await this.loop;
  }

  /** Цикл опроса. Из него не выходят по ошибке — только по остановке приложения. */
  private async poll(): Promise<void> {
    this.log.log("Опрос обновлений запущен");
    while (this.running) {
      const updates = await this.telegram.call<Update[]>(
        "getUpdates",
        { offset: this.offset, timeout: POLL_SECONDS, allowed_updates: ALLOWED_UPDATES },
        POLL_SECONDS * 1000 + POLL_SLACK_MS,
        this.stopping.signal,
      );

      if (!updates) {
        await delay(RETRY_DELAY_MS, this.stopping.signal);
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

    await this.acknowledge();
  }

  /**
   * Сказать Telegram, что разобранное разобрано.
   *
   * `getUpdates` с текущим `offset` — единственный способ это подтвердить, а
   * штатно он случается на следующем витке цикла, которого при остановке уже
   * не будет. Своим сигналом, а не `this.stopping`: тот уже сработал.
   */
  private async acknowledge(): Promise<void> {
    if (this.offset === 0) return;
    await this.telegram.call("getUpdates", { offset: this.offset, timeout: 0, limit: 1 }, ACK_TIMEOUT_MS);
    this.log.log("Опрос обновлений остановлен, разобранное подтверждено");
  }

  /** Разбор одного обновления. Публичный ради тестов: цикл опроса проверять нечем. */
  async handleUpdate(update: Update): Promise<void> {
    if (update.callback_query) {
      await this.handleCallback(update.callback_query);
      return;
    }

    const chatId = update.message?.chat?.id;
    const from = update.message?.from;
    const parsed = parseCommand(update.message?.text ?? "");
    if (chatId === undefined || !parsed) return;

    switch (parsed.command) {
      case "start":
        await this.handleStart(chatId, from, parsed.payload);
        return;
      case "invite":
        await this.handleInvite(chatId, from);
        return;
      case "admins":
        await this.handleAdmins(chatId, from);
        return;
      default:
        return;
    }
  }

  /** `/start`: приглашение, если в нагрузке код, иначе приветствие. */
  private async handleStart(chatId: number, from?: TelegramUser, payload = ""): Promise<void> {
    // Приглашение принимается только в личном чате: в группе оно сделало бы
    // менеджером того, кто первым нажал `/start` на глазах у всех. Остальные
    // нагрузки (UTM из рекламной ссылки) приветствие не трогают.
    if (payload.startsWith(INVITE_PREFIX) && from?.id !== undefined && chatId > 0) {
      await this.acceptInvite(chatId, from, payload);
      return;
    }
    await this.sendGreeting(chatId, from?.id);
  }

  private async acceptInvite(chatId: number, from: TelegramUser, payload: string): Promise<void> {
    const invalid = (): Promise<unknown> =>
      this.telegram.call("sendMessage", {
        chat_id: chatId,
        text: "Ссылка не действует: приглашение одноразовое и живёт сутки. Попросите новое.",
      });

    // Испорченную ссылку («…start=admin_вставилось-не-то») до базы не доносим,
    // но и молча приветствием не отвечаем: человек шёл по приглашению и должен
    // понять, что оно не сработало.
    const code = inviteCodeFromPayload(payload);
    if (!code) {
      await invalid();
      return;
    }

    const result = await this.admins.acceptInvite(code, {
      telegramId: String(from.id),
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
    });

    if (!result.ok) {
      if (result.reason === "already-admin") {
        await this.telegram.call("sendMessage", {
          chat_id: chatId,
          text: "У вас уже есть доступ к заявкам.",
        });
      } else {
        await invalid();
      }
      return;
    }

    await this.telegram.call("sendMessage", {
      chat_id: chatId,
      text: [
        "Готово: вы менеджер Микки Шопа.",
        "",
        "Заявки о новых заказах будут приходить сюда, статус меняется кнопками под заявкой.",
      ].join("\n"),
    });

    // Владельцу — кто именно воспользовался ссылкой: он её пересылал, но
    // нажать мог не тот, кому она предназначалась.
    if (result.invitedBy) {
      const name = from.username ? `@${from.username}` : (from.first_name ?? String(from.id));
      await this.telegram.call("sendMessage", {
        chat_id: result.invitedBy,
        text: `Приглашение принято: ${name} (id ${String(from.id)}). Список — /admins`,
      });
    }
  }

  /** `/invite`: одноразовая ссылка, которой владелец заводит менеджера. */
  private async handleInvite(chatId: number, from?: TelegramUser): Promise<void> {
    if (!(await this.ownerOnly(chatId, from))) return;

    const username = await this.botUsername();
    if (!username) {
      await this.telegram.call("sendMessage", {
        chat_id: chatId,
        text: "Не удалось узнать имя бота у Telegram — попробуйте ещё раз.",
      });
      return;
    }

    const { code, expiresAt } = await this.admins.createInvite(String(from?.id));
    await this.telegram.call("sendMessage", {
      chat_id: chatId,
      text: [
        "Ссылка для нового менеджера:",
        "",
        inviteLink(username, code),
        "",
        `Одноразовая, действует до ${expiresAt.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} (МСК).`,
        "Перешлите её человеку: он нажмёт «Начать», и доступ появится сразу.",
      ].join("\n"),
      // Предпросмотр ссылки Telegram рисует карточкой бота — она тут не к месту
      // и занимает пол-экрана.
      link_preview_options: { is_disabled: true },
    });
  }

  /** `/admins`: кто имеет доступ, с кнопками «убрать». */
  private async handleAdmins(chatId: number, from?: TelegramUser): Promise<void> {
    if (!(await this.ownerOnly(chatId, from))) return;

    const { text, reply_markup } = formatAdmins(await this.admins.list());
    await this.telegram.call("sendMessage", { chat_id: chatId, text, reply_markup });
  }

  /**
   * Отвечает отказом и `false`, если это не владелец или не личный чат.
   *
   * Чат важен не меньше, чем человек: `/invite@Бот`, набранный в общей группе,
   * положил бы туда живую одноразовую ссылку — и менеджером стал бы любой, кто
   * успел её нажать. `/admins` в группе точно так же показал бы всем список
   * доступов вместе с кнопками «убрать».
   */
  private async ownerOnly(chatId: number, from?: TelegramUser): Promise<boolean> {
    if (chatId < 0) {
      await this.telegram.call("sendMessage", {
        chat_id: chatId,
        text: "Про доступы — в личном чате со мной, не в группе.",
      });
      return false;
    }

    if (from?.id !== undefined && this.admins.isOwner(String(from.id))) return true;

    await this.telegram.call("sendMessage", {
      chat_id: chatId,
      text: "Раздавать доступ может только владелец магазина.",
    });
    return false;
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

    const id = fromId === undefined ? "" : String(fromId);
    if (id && (await this.admins.isAdmin(id))) {
      lines.push("", "Заявки на заказы приходят сюда — статус меняется кнопками под заявкой.");
      if (this.admins.isOwner(id)) {
        lines.push("Пригласить менеджера — /invite, список — /admins.");
      }
    }

    await this.telegram.call("sendMessage", {
      chat_id: chatId,
      text: lines.join("\n"),
      ...(button ? { reply_markup: button } : {}),
    });
  }

  /**
   * Нажатие кнопки.
   *
   * На нажатие отвечают всегда — иначе кнопка в клиенте крутится до таймаута,
   * и человек жмёт её второй раз, думая, что не попал.
   */
  private async handleCallback(query: NonNullable<Update["callback_query"]>): Promise<void> {
    try {
      if ((query.data ?? "").startsWith("admin:")) {
        await this.handleRevoke(query);
      } else {
        await this.handleStatus(query);
      }
    } catch (error) {
      // База моргнула — нажатие всё равно надо закрыть: иначе кнопка крутится
      // до таймаута, и человек жмёт её второй раз, думая, что не попал.
      this.log.error(`Нажатие ${query.id} не обработано: ${String(error)}`);
      await this.telegram.call("answerCallbackQuery", {
        callback_query_id: query.id,
        text: "Не получилось — попробуйте ещё раз",
      });
    }
  }

  private async handleStatus(query: NonNullable<Update["callback_query"]>): Promise<void> {
    const answer = (text: string): Promise<unknown> =>
      this.telegram.call("answerCallbackQuery", { callback_query_id: query.id, text });

    // `callback_data` приходит от клиента Telegram, то есть от кого угодно, кто
    // дотянулся до кнопки: пересланное сообщение с кнопками нажимается любым
    // получателем. Право менять статус проверяется по тому, кто нажал, а не по
    // тому, что нажали.
    const fromId = query.from?.id;
    if (fromId === undefined || !(await this.admins.isAdmin(String(fromId)))) {
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
    // ошибка на пути, который сам код считает нормальным. Копия у другого
    // менеджера при этом отстала от жизни, и её как раз надо обновить.
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

  /** Нажатие «убрать» в списке менеджеров. */
  private async handleRevoke(query: NonNullable<Update["callback_query"]>): Promise<void> {
    const answer = (text: string): Promise<unknown> =>
      this.telegram.call("answerCallbackQuery", { callback_query_id: query.id, text });

    const fromId = query.from?.id;
    if (fromId === undefined || !this.admins.isOwner(String(fromId))) {
      await answer("Это кнопка владельца");
      return;
    }

    const userId = /^admin:revoke:([\w-]{1,64})$/.exec(query.data ?? "")?.[1];
    if (!userId) {
      await answer("Кнопка устарела");
      return;
    }

    const result = await this.admins.revoke(userId);
    if (!result.ok) {
      await answer(
        result.reason === "owner" ? "Владельца снять нельзя" : "Этот человек уже без доступа",
      );
      return;
    }

    await answer(`Доступ снят: ${result.name}`);

    // Человеку — что доступа больше нет: иначе он узнает об этом, только нажав
    // кнопку под старой заявкой.
    await this.telegram.call("sendMessage", {
      chat_id: result.telegramId,
      text: "Доступ к заявкам Микки Шопа снят.",
    });

    const chatId = query.message?.chat?.id;
    const messageId = query.message?.message_id;
    if (chatId === undefined || messageId === undefined) return;

    const { text, reply_markup } = formatAdmins(await this.admins.list());
    await this.telegram.call("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      reply_markup,
    });
  }

  /** Имя бота из `getMe`. Спрашивается один раз: оно не меняется на ходу. */
  private async botUsername(): Promise<string> {
    if (this.username) return this.username;

    const me = await this.telegram.call<{ username?: string }>("getMe", {});
    this.username = me?.username ?? "";
    return this.username;
  }
}
