import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigService } from "@nestjs/config";
import { TelegramApi } from "./telegram-api";

const config = (values: Record<string, string>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

const response = (body: unknown, status = 200) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => response({ ok: true, result: { message_id: 5 } }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TelegramApi", () => {
  it("зовёт метод Bot API с токеном из конфига", async () => {
    const api = new TelegramApi(config({ TELEGRAM_BOT_TOKEN: "123:abc" }));

    const result = await api.call("sendMessage", { chat_id: 1, text: "привет" });

    expect(result).toEqual({ message_id: 5 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bot123:abc/sendMessage");
    expect(JSON.parse(String(init.body))).toEqual({ chat_id: 1, text: "привет" });
  });

  // Без токена бот выключен целиком, а не «ходит без него»: иначе каждый вызов
  // давал бы 404 от Telegram и строку в логе.
  it("без токена не ходит никуда", async () => {
    const api = new TelegramApi(config({}));

    expect(api.enabled).toBe(false);
    expect(await api.call("sendMessage", {})).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * Ни заказ, ни цикл опроса нельзя ронять из-за молчащего Telegram: отказ —
   * это `null` и строка в логе.
   */
  it("возвращает null, а не бросает, на отказ Telegram", async () => {
    fetchMock.mockResolvedValue(response({ ok: false, description: "chat not found" }, 400));
    const api = new TelegramApi(config({ TELEGRAM_BOT_TOKEN: "123:abc" }));

    await expect(api.call("sendMessage", {})).resolves.toBeNull();
  });

  it("переживает ответ не JSON — от прокси или заглушки", async () => {
    fetchMock.mockResolvedValue(response("<html>403 Forbidden</html>", 403));
    const api = new TelegramApi(config({ TELEGRAM_BOT_TOKEN: "123:abc" }));

    await expect(api.call("sendMessage", {})).resolves.toBeNull();
  });

  it("переживает обрыв связи", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    const api = new TelegramApi(config({ TELEGRAM_BOT_TOKEN: "123:abc" }));

    await expect(api.call("sendMessage", {})).resolves.toBeNull();
  });

  // В сети, которая дропает пакеты вместо отказа, `fetch` без таймаута висит
  // до своих внутренних — и вешает вместе с собой цикл опроса.
  it("ограничивает время запроса", async () => {
    const api = new TelegramApi(config({ TELEGRAM_BOT_TOKEN: "123:abc" }));

    await api.call("getUpdates", {}, 1_000);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
