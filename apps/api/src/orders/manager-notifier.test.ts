import "reflect-metadata";
import { describe, expect, it } from "vitest";
import type { Order } from "@mikki-shop/shared-types";
import { format } from "./manager-notifier";

/** Та же денежная форма, что и в заявке: `Intl` ставит неразрывный пробел. */
const money = (value: number) => `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;

function order(over: Partial<Order> = {}): Order {
  return {
    number: 42,
    status: "NEW",
    createdAt: "2026-09-03T12:00:00.000Z",
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

describe("format — заявка менеджеру", () => {
  it("содержит всё, что нужно, чтобы позвонить и собрать заказ", () => {
    const text = format(order({ petName: "Микки", comment: "Домофон 12" }));

    expect(text).toContain("Заказ 42");
    expect(text).toContain("Денис, +7 916 123-45-67");
    expect(text).toContain("Курьер: Москва, Тверская 1");
    expect(text).toContain("Питомец: Микки");
    expect(text).toContain("Комментарий: Домофон 12");
    expect(text).toContain("Бандана «Клетка» — M, Кирпичный × 2");
    // Разделитель разрядов ставит `Intl` — он неразрывный, а не обычный пробел.
    expect(text).toContain(`Итого: ${money(1180)}`);
  });

  it("у самовывоза не пишет пустой адрес", () => {
    const text = format(order({ delivery: "pickup", address: undefined }));

    expect(text).toContain("Самовывоз");
    expect(text).not.toContain("Самовывоз:");
  });

  it("не выдумывает строк про питомца и комментарий, когда их нет", () => {
    const text = format(order());

    expect(text).not.toContain("Питомец");
    expect(text).not.toContain("Комментарий");
  });

  // Простым текстом, без Markdown: любая кличка со звёздочкой или
  // подчёркиванием сломала бы разметку, а экранировать её ради жирного
  // шрифта не стоит того.
  it("не размечает текст", () => {
    const text = format(order({ petName: "Мик*ки_1" }));

    expect(text).toContain("Мик*ки_1");
    expect(text).not.toMatch(/\*\*|__/);
  });
});
