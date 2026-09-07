import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Order } from "@mikki-shop/shared-types";
import type { ConfigService } from "@nestjs/config";
import { BotService } from "./bot.service";
import type { TelegramApi } from "./telegram-api";
import type { OrdersService, StatusChange } from "../orders/orders.service";
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
let env: Record<string, string>;
let bot: BotService;

/** Полезная нагрузка последнего вызова названного метода Bot API. */
function payloadOf(method: string): Payload | undefined {
  const found = [...call.mock.calls].reverse().find((args) => args[0] === method);
  return found?.[1] as Payload | undefined;
}

beforeEach(() => {
  call = vi.fn(async () => ({}));
  setStatus = vi.fn(
    async (): Promise<StatusChange> => ({ ok: true, order: order(), changed: true }),
  );
  env = { MANAGER_CHAT_ID: String(MANAGER) };

  bot = new BotService(
    { enabled: true, call } as unknown as TelegramApi,
    { setStatus } as unknown as OrdersService,
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

  it("пускает всех перечисленных в ADMIN_TELEGRAM_IDS, а не только владельца чата заявок", async () => {
    env = { MANAGER_CHAT_ID: "-100500", ADMIN_TELEGRAM_IDS: `111, ${STRANGER}` };

    await bot.handleUpdate(press({ from: { id: STRANGER } }));

    expect(setStatus).toHaveBeenCalled();
  });

  // Пусто — не может никто: безопасный отказ, а не «можно всем».
  it("никого не пускает, когда менеджеры не заданы", async () => {
    env = {};

    await bot.handleUpdate(press());

    expect(setStatus).not.toHaveBeenCalled();
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
