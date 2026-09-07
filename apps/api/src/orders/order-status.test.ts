import { describe, expect, it } from "vitest";
import type { OrderStatus } from "@mikki-shop/shared-types";
import {
  NEXT_STATUSES,
  callbackData,
  canGo,
  parseCallback,
  statusKeyboard,
} from "./order-status";

describe("переходы статусов", () => {
  it("ведёт заказ по пути «новый → подтверждён → отправлен → получен»", () => {
    expect(canGo("NEW", "CONFIRMED")).toBe(true);
    expect(canGo("CONFIRMED", "SHIPPED")).toBe(true);
    expect(canGo("SHIPPED", "DONE")).toBe(true);
  });

  it("разрешает отмену на всём пути до получения", () => {
    expect(canGo("NEW", "CANCELLED")).toBe(true);
    expect(canGo("CONFIRMED", "CANCELLED")).toBe(true);
    expect(canGo("SHIPPED", "CANCELLED")).toBe(true);
  });

  // Иначе отменённый заказ отменяли бы второй раз, возвращая остаток дважды.
  it("не выпускает из конечных статусов", () => {
    expect(NEXT_STATUSES.DONE).toEqual([]);
    expect(NEXT_STATUSES.CANCELLED).toEqual([]);
    expect(canGo("CANCELLED", "CONFIRMED")).toBe(false);
    expect(canGo("DONE", "CANCELLED")).toBe(false);
  });

  it("не перепрыгивает через подтверждение", () => {
    expect(canGo("NEW", "SHIPPED")).toBe(false);
    expect(canGo("NEW", "DONE")).toBe(false);
  });
});

describe("данные кнопки", () => {
  it("разбирает то, что сам собрал", () => {
    expect(parseCallback(callbackData(1042, "SHIPPED"))).toEqual({
      number: 1042,
      status: "SHIPPED",
    });
  });

  // `callback_data` приходит от клиента Telegram, то есть от кого угодно, кто
  // дотянулся до кнопки: неизвестное — `null`, а не «наверное, статус».
  it("отвергает чужое и испорченное", () => {
    expect(parseCallback("")).toBeNull();
    expect(parseCallback("order:1:DROP")).toBeNull();
    expect(parseCallback("order:1:CONFIRMED ")).toBeNull();
    expect(parseCallback("order:abc:CONFIRMED")).toBeNull();
    expect(parseCallback("заказ:1:CONFIRMED")).toBeNull();
    // `NEW` кнопкой не ставят: вернуть заказ в «менеджер ещё не смотрел» нечем.
    expect(parseCallback("order:1:NEW")).toBeNull();
  });

  // У Telegram на `callback_data` жёсткие 64 байта, и молча обрезанная кнопка
  // не сработает вовсе.
  it("влезает в предел Telegram", () => {
    const longest = callbackData(999_999_999, "CONFIRMED");

    expect(Buffer.byteLength(longest, "utf8")).toBeLessThanOrEqual(64);
  });
});

describe("клавиатура заявки", () => {
  it("предлагает ровно те переходы, что разрешены", () => {
    const keyboard = statusKeyboard(42, "NEW");

    expect(keyboard?.inline_keyboard[0]?.map((button) => button.callback_data)).toEqual([
      "order:42:CONFIRMED",
      "order:42:CANCELLED",
    ]);
  });

  // `undefined`, а не пустой массив: при правке сообщения `reply_markup` тогда
  // не уедет вовсе, и Telegram уберёт кнопки.
  it("исчезает в конце пути", () => {
    expect(statusKeyboard(42, "DONE")).toBeUndefined();
    expect(statusKeyboard(42, "CANCELLED")).toBeUndefined();
  });

  it("подписывает кнопки действием, а не названием статуса", () => {
    const texts = (statusKeyboard(42, "NEW") as { inline_keyboard: { text: string }[][] })
      .inline_keyboard[0]!.map((button) => button.text);

    expect(texts).toEqual(["Подтвердить", "Отменить"]);
  });

  it("знает все статусы схемы", () => {
    const statuses: OrderStatus[] = ["NEW", "CONFIRMED", "SHIPPED", "DONE", "CANCELLED"];

    for (const status of statuses) expect(NEXT_STATUSES[status]).toBeDefined();
  });
});
