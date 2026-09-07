import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Order } from "@mikki-shop/shared-types";
import type { ConfigService } from "@nestjs/config";
import { BotService, parseCommand } from "./bot.service";
import type { TelegramApi } from "./telegram-api";
import type { OrdersService, StatusChange } from "../orders/orders.service";
import type { AdminsService } from "../admins/admins.service";
import { format } from "../orders/manager-notifier";

const MANAGER = 777;
const STRANGER = 999;

function order(over: Partial<Order> = {}): Order {
  return {
    number: 42,
    status: "CONFIRMED",
    createdAt: "2026-09-07T12:00:00.000Z",
    customerName: "Денис",
    phone: "+7 916 123-45-67",
    delivery: "courier",
    address: "Москва, Тверская 1",
    total: 1180,
    lines: [
      {
        slug: "bandana-kletka",
        title: "Бандана «Клетка»",
        size: "M",
        color: "Кирпичный",
        price: 590,
        quantity: 2,
      },
    ],
    ...over,
  };
}

/** Нажатие кнопки под заявкой. */
function press(over: Record<string, unknown> = {}) {
  return {
    update_id: 1,
    callback_query: {
      id: "cb1",
      data: "order:42:CONFIRMED",
      from: { id: MANAGER },
      message: { chat: { id: MANAGER }, message_id: 5 },
      ...over,
    },
  };
}

type Payload = Record<string, unknown>;

let call: ReturnType<typeof vi.fn>;
let setStatus: ReturnType<typeof vi.fn>;
let isAdmin: ReturnType<typeof vi.fn>;
let isOwner: ReturnType<typeof vi.fn>;
let acceptInvite: ReturnType<typeof vi.fn>;
let createInvite: ReturnType<typeof vi.fn>;
let listAdmins: ReturnType<typeof vi.fn>;
let revoke: ReturnType<typeof vi.fn>;
let env: Record<string, string>;
let bot: BotService;

/** Полезная нагрузка последнего вызова названного метода Bot API. */
function payloadOf(method: string): Payload | undefined {
  const found = [...call.mock.calls].reverse().find((args) => args[0] === method);
  return found?.[1] as Payload | undefined;
}

beforeEach(() => {
  call = vi.fn(async (method: string) =>
    method === "getMe" ? { username: "MikkiWithLove_bot" } : {},
  );
  setStatus = vi.fn(
    async (): Promise<StatusChange> => ({ ok: true, order: order(), changed: true }),
  );
  // По умолчанию доступ только у владельца — он же получатель заявок.
  isAdmin = vi.fn(async (id: string) => id === String(MANAGER));
  isOwner = vi.fn((id: string) => id === String(MANAGER));
  acceptInvite = vi.fn(async () => ({ ok: true, userId: "u1", invitedBy: String(MANAGER) }));
  createInvite = vi.fn(async () => ({
    code: "SGVsbG8gd29ybGQh",
    expiresAt: new Date("2026-09-08T12:00:00Z"),
  }));
  listAdmins = vi.fn(async () => ({
    invited: [
      {
        userId: "u0",
        telegramId: String(MANAGER),
        username: "den",
        firstName: "Денис",
        role: "OWNER" as const,
      },
      {
        userId: "u1",
        telegramId: "555",
        username: null,
        firstName: "Аня",
        role: "ADMIN" as const,
      },
    ],
    fromEnv: [],
  }));
  revoke = vi.fn(async () => ({ ok: true, telegramId: "555", name: "Аня" }));
  env = { MANAGER_CHAT_ID: String(MANAGER) };

  bot = new BotService(
    { enabled: true, call } as unknown as TelegramApi,
    { setStatus } as unknown as OrdersService,
    {
      isAdmin,
      isOwner,
      acceptInvite,
      createInvite,
      list: listAdmins,
      revoke,
    } as unknown as AdminsService,
    { get: (key: string) => env[key] } as unknown as ConfigService,
  );
});

describe("BotService — кнопки статуса", () => {
  it("меняет статус и отвечает на нажатие", async () => {
    await bot.handleUpdate(press());

    expect(setStatus).toHaveBeenCalledWith(42, "CONFIRMED");
    expect(payloadOf("answerCallbackQuery")).toMatchObject({
      callback_query_id: "cb1",
      text: "Заказ 42: Подтверждён",
    });
  });

  it("переписывает заявку под новый статус и новые кнопки", async () => {
    await bot.handleUpdate(press());
    const edit = payloadOf("editMessageText") as {
      chat_id: number;
      message_id: number;
      text: string;
      reply_markup?: { inline_keyboard: { callback_data: string }[][] };
    };

    expect(edit).toMatchObject({ chat_id: MANAGER, message_id: 5 });
    expect(edit.text).toContain("Статус: Подтверждён");
    // Из подтверждённого дальше — «Отправлен» и «Отменить», а не «Подтвердить».
    expect(edit.reply_markup?.inline_keyboard[0]?.map((b) => b.callback_data)).toEqual([
      "order:42:SHIPPED",
      "order:42:CANCELLED",
    ]);
  });

  it("убирает кнопки, когда путь заказа закончился", async () => {
    setStatus.mockResolvedValue({ ok: true, order: order({ status: "DONE" }), changed: true });

    await bot.handleUpdate(press({ data: "order:42:DONE" }));

    // `undefined` в `reply_markup` — Telegram уберёт клавиатуру.
    expect(payloadOf("editMessageText")).toMatchObject({ reply_markup: undefined });
  });

  /**
   * Заявку с кнопками можно переслать кому угодно, и нажать их сможет любой
   * получатель: право проверяется по тому, кто нажал.
   */
  it("не принимает нажатие от чужого", async () => {
    await bot.handleUpdate(press({ from: { id: STRANGER } }));

    expect(setStatus).not.toHaveBeenCalled();
    expect(payloadOf("answerCallbackQuery")).toMatchObject({ text: "Это кнопка менеджера" });
  });

  // Права спрашиваются у списка доступов, а не у переменной окружения:
  // приглашённый менеджер жмёт те же кнопки.
  it("пускает приглашённого менеджера", async () => {
    isAdmin.mockResolvedValue(true);

    await bot.handleUpdate(press({ from: { id: STRANGER } }));

    expect(isAdmin).toHaveBeenCalledWith(String(STRANGER));
    expect(setStatus).toHaveBeenCalled();
  });

  it("отвечает на нажатие даже с непонятными данными", async () => {
    await bot.handleUpdate(press({ data: "order:42:DROP TABLE" }));

    expect(setStatus).not.toHaveBeenCalled();
    expect(payloadOf("answerCallbackQuery")).toMatchObject({ text: "Кнопка устарела" });
  });

  it("называет причину отказа словами", async () => {
    setStatus.mockResolvedValue({ ok: false, reason: "not-found" });
    await bot.handleUpdate(press());
    expect(payloadOf("answerCallbackQuery")).toMatchObject({ text: "Заказ 42 не найден" });

    setStatus.mockResolvedValue({ ok: false, reason: "not-allowed" });
    await bot.handleUpdate(press());
    expect(payloadOf("answerCallbackQuery")?.text).toContain("так нельзя");
  });

  /**
   * Нажали то, что уже стоит: правка совпала бы с тем, что в чате, а Telegram
   * отвергает такую («message is not modified») — и это легло бы в лог ошибкой
   * на пути, который код считает нормальным.
   */
  it("не правит заявку, когда править нечего", async () => {
    setStatus.mockResolvedValue({ ok: true, order: order(), changed: false });
    // Ровно тот текст, что сейчас в чате: собран тем же `format`, что и правка,
    // — иначе сравнение разошлось бы на неразрывном пробеле в сумме.
    const current = press({
      message: { chat: { id: MANAGER }, message_id: 5, text: format(order()) },
    });

    await bot.handleUpdate(current);

    expect(payloadOf("answerCallbackQuery")).toBeDefined();
    expect(payloadOf("editMessageText")).toBeUndefined();
  });

  // А вот отставшую заявку (в чате ещё «Новый») поправить надо — иначе у
  // менеджера останутся кнопки, которых уже нет.
  it("правит заявку, отставшую от статуса", async () => {
    setStatus.mockResolvedValue({ ok: true, order: order(), changed: false });
    const stale = press({
      message: { chat: { id: MANAGER }, message_id: 5, text: "Статус: Новый" },
    });

    await bot.handleUpdate(stale);

    expect(payloadOf("editMessageText")?.text).toContain("Статус: Подтверждён");
  });

  // Сообщение старше 48 часов Telegram править не даёт, но статус уже изменён —
  // это не повод считать нажатие неудавшимся.
  it("переживает нажатие без сообщения под рукой", async () => {
    await bot.handleUpdate(press({ message: undefined }));

    expect(setStatus).toHaveBeenCalled();
    expect(payloadOf("editMessageText")).toBeUndefined();
  });
});

describe("BotService — /start", () => {
  const start = (text: string, from = STRANGER) => ({
    update_id: 2,
    message: { chat: { id: from }, from: { id: from }, text },
  });

  it("отвечает приветствием с кнопкой, открывающей Mini App", async () => {
    env = { ...env, WEBAPP_URL: "https://shop.example" };

    await bot.handleUpdate(start("/start"));
    const sent = payloadOf("sendMessage") as {
      text: string;
      reply_markup?: { inline_keyboard: { web_app: { url: string } }[][] };
    };

    expect(sent.text).toContain("Микки Шоп");
    expect(sent.reply_markup?.inline_keyboard[0]?.[0]?.web_app.url).toBe("https://shop.example");
  });

  /**
   * Telegram принимает в `web_app` только HTTPS и отвергает весь `sendMessage`:
   * с недонастроенным адресом покупатель не получил бы даже приветствия.
   */
  it("не рискует приветствием ради кнопки с непригодным адресом", async () => {
    env = { ...env, WEBAPP_URL: "http://127.0.0.1:8080" };

    await bot.handleUpdate(start("/start"));

    expect(payloadOf("sendMessage")).not.toHaveProperty("reply_markup");
    expect(payloadOf("sendMessage")?.text).toContain("Микки Шоп");
  });

  it("понимает команду с нагрузкой и с именем бота", async () => {
    await bot.handleUpdate(start("/start utm_tiktok"));
    await bot.handleUpdate(start("/start@MikkiWithLove_bot"));

    expect(call.mock.calls.filter((args) => args[0] === "sendMessage")).toHaveLength(2);
  });

  it("менеджеру дополнительно объясняет кнопки под заявками", async () => {
    await bot.handleUpdate(start("/start", MANAGER));

    expect(payloadOf("sendMessage")?.text).toContain("кнопками под заявкой");
  });

  /**
   * `web_app` живёт только в личном чате, и в группе Telegram отвергает весь
   * `sendMessage` — то же, что с адресом не по HTTPS. Команда `/start@Бот`
   * приходит именно из группы.
   */
  it("в группе отвечает без кнопки", async () => {
    env = { ...env, WEBAPP_URL: "https://shop.example" };

    await bot.handleUpdate({
      update_id: 3,
      message: { chat: { id: -100500 }, from: { id: STRANGER }, text: "/start@MikkiWithLove_bot" },
    });

    expect(payloadOf("sendMessage")).not.toHaveProperty("reply_markup");
    expect(payloadOf("sendMessage")?.text).toContain("Микки Шоп");
  });

  it("на прочие сообщения не отвечает", async () => {
    await bot.handleUpdate(start("привет"));

    expect(call).not.toHaveBeenCalled();
  });
});

describe("BotService — приглашение менеджеров", () => {
  const message = (text: string, from = MANAGER, chat = from) => ({
    update_id: 4,
    message: { chat: { id: chat }, from: { id: from, username: "den", first_name: "Денис" }, text },
  });

  it("выдаёт владельцу одноразовую ссылку", async () => {
    await bot.handleUpdate(message("/invite"));

    expect(createInvite).toHaveBeenCalledWith(String(MANAGER));
    const sent = payloadOf("sendMessage") as { text: string };
    expect(sent.text).toContain("https://t.me/MikkiWithLove_bot?start=admin_SGVsbG8gd29ybGQh");
    expect(sent.text).toContain("Одноразовая");
  });

  /**
   * Живая одноразовая ссылка в общей группе — это менеджер из любого, кто успел
   * её нажать. Владелец при этом настоящий, поэтому проверки «кто» мало.
   */
  it("не выкладывает ссылку в группу даже владельцу", async () => {
    await bot.handleUpdate(message("/invite@MikkiBot", MANAGER, -100500));

    expect(createInvite).not.toHaveBeenCalled();
    expect(payloadOf("sendMessage")?.text).toContain("в личном чате");
  });

  it("не показывает список доступов в группе", async () => {
    await bot.handleUpdate(message("/admins", MANAGER, -100500));

    expect(listAdmins).not.toHaveBeenCalled();
  });

  // Иначе менеджер, которому дали кнопки, заводил бы себе новых менеджеров.
  it("не выдаёт ссылку никому, кроме владельца", async () => {
    await bot.handleUpdate(message("/invite", STRANGER));

    expect(createInvite).not.toHaveBeenCalled();
    expect(payloadOf("sendMessage")?.text).toContain("только владелец");
  });

  it("принимает приглашение по ссылке и говорит об этом владельцу", async () => {
    await bot.handleUpdate(message("/start admin_SGVsbG8gd29ybGQh", STRANGER));

    expect(acceptInvite).toHaveBeenCalledWith("SGVsbG8gd29ybGQh", {
      telegramId: String(STRANGER),
      username: "den",
      firstName: "Денис",
      lastName: undefined,
    });
    const messages = call.mock.calls.filter((args) => args[0] === "sendMessage");
    expect((messages[0]?.[1] as Payload).text).toContain("вы менеджер");
    // Ссылку пересылали, и нажать её мог не тот, кому она предназначалась.
    expect(messages[1]?.[1]).toMatchObject({ chat_id: String(MANAGER) });
    expect((messages[1]?.[1] as Payload).text).toContain("Приглашение принято");
  });

  it("объясняет отказ, а не молчит", async () => {
    acceptInvite.mockResolvedValue({ ok: false, reason: "expired" });

    await bot.handleUpdate(message("/start admin_SGVsbG8gd29ybGQh", STRANGER));

    expect(payloadOf("sendMessage")?.text).toContain("Ссылка не действует");
  });

  /**
   * В группе `/start` с кодом сделал бы менеджером того, кто первым нажал на
   * глазах у всех: приглашение — разговор один на один.
   */
  it("не принимает приглашение в группе", async () => {
    await bot.handleUpdate(message("/start admin_SGVsbG8gd29ybGQh", STRANGER, -100500));

    expect(acceptInvite).not.toHaveBeenCalled();
    expect(payloadOf("sendMessage")?.text).toContain("Микки Шоп");
  });

  // Человек шёл по приглашению: молчаливое приветствие оставило бы его гадать,
  // сработало оно или нет.
  it("на испорченную ссылку отвечает отказом, а не приветствием", async () => {
    await bot.handleUpdate(message("/start admin_вставилось-не-то", STRANGER));

    expect(acceptInvite).not.toHaveBeenCalled();
    expect(payloadOf("sendMessage")?.text).toContain("Ссылка не действует");
  });

  it("UTM-метку за приглашение не принимает", async () => {
    await bot.handleUpdate(message("/start utm_tiktok", STRANGER));

    expect(acceptInvite).not.toHaveBeenCalled();
  });

  it("показывает владельцу список с кнопками «убрать»", async () => {
    await bot.handleUpdate(message("/admins"));
    const sent = payloadOf("sendMessage") as {
      text: string;
      reply_markup?: { inline_keyboard: { text: string; callback_data: string }[][] };
    };

    expect(sent.text).toContain("Денис");
    expect(sent.text).toContain("владелец");
    // Кнопка есть только у менеджера: владельца снимать нечем.
    expect(sent.reply_markup?.inline_keyboard).toEqual([
      [{ text: "Убрать: Аня", callback_data: "admin:revoke:u1" }],
    ]);
  });

  it("снимает доступ, говорит человеку и обновляет список", async () => {
    const revokePress = {
      update_id: 5,
      callback_query: {
        id: "cb2",
        data: "admin:revoke:u1",
        from: { id: MANAGER },
        message: { chat: { id: MANAGER }, message_id: 7, text: "Доступ к заявкам:" },
      },
    };

    await bot.handleUpdate(revokePress);

    expect(revoke).toHaveBeenCalledWith("u1");
    expect(payloadOf("answerCallbackQuery")).toMatchObject({ text: "Доступ снят: Аня" });
    expect(payloadOf("sendMessage")).toMatchObject({ chat_id: "555" });
    expect(payloadOf("editMessageText")).toMatchObject({ message_id: 7 });
  });

  it("кнопку «убрать» не отдаёт менеджеру", async () => {
    isAdmin.mockResolvedValue(true);

    await bot.handleUpdate({
      update_id: 6,
      callback_query: {
        id: "cb3",
        data: "admin:revoke:u1",
        from: { id: STRANGER },
        message: { chat: { id: STRANGER }, message_id: 7 },
      },
    });

    expect(revoke).not.toHaveBeenCalled();
    expect(payloadOf("answerCallbackQuery")).toMatchObject({ text: "Это кнопка владельца" });
  });
});

describe("BotService — отказы, которые нельзя проглотить", () => {
  // Иначе кнопка крутится до таймаута, и менеджер жмёт её второй раз.
  it("отвечает на нажатие, даже если обработчик упал", async () => {
    setStatus.mockRejectedValue(new Error("база моргнула"));

    await bot.handleUpdate(press());

    expect(payloadOf("answerCallbackQuery")).toMatchObject({
      callback_query_id: "cb1",
      text: "Не получилось — попробуйте ещё раз",
    });
  });

  /**
   * `offset` уезжает в Telegram только со следующим запросом, а при остановке
   * его не будет: та же пачка приедет заново к заменяющему контейнеру и
   * выполнится дважды.
   */
  it("подтверждает разобранное перед остановкой", async () => {
    call.mockImplementation(async (method: string) =>
      method === "getUpdates" ? [{ update_id: 41, message: {} }] : {},
    );
    env = { ...env, TELEGRAM_BOT_TOKEN: "123:abc" };

    bot.onModuleInit();
    await bot.onModuleDestroy();

    const acks = call.mock.calls.filter(
      (args) => args[0] === "getUpdates" && (args[1] as Payload).timeout === 0,
    );
    expect(acks).toHaveLength(1);
    expect(acks[0]?.[1]).toMatchObject({ offset: 42, limit: 1 });
  });
});

describe("parseCommand", () => {
  it("отделяет команду от нагрузки", () => {
    expect(parseCommand("/start admin_abc")).toEqual({ command: "start", payload: "admin_abc" });
    expect(parseCommand("/start@MikkiBot admin_abc")).toEqual({
      command: "start",
      payload: "admin_abc",
    });
    expect(parseCommand("  /Admins  ")).toEqual({ command: "admins", payload: "" });
  });

  it("не видит команды там, где её нет", () => {
    expect(parseCommand("привет")).toBeNull();
    expect(parseCommand("напиши /invite другу")).toBeNull();
    expect(parseCommand("")).toBeNull();
  });
});
