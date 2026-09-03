// Декораторы Nest пишут метаданные через `Reflect.defineMetadata`, которого в
// голом рантайме нет. Контроллер создаётся руками, но полифил нужен, чтобы
// модуль вообще загрузился.
import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CartItemInput } from "@mikki-shop/shared-types";
import { CartController } from "./cart.controller";
import type { CartService } from "./cart.service";

let preview: ReturnType<typeof vi.fn>;
let controller: CartController;

beforeEach(() => {
  preview = vi.fn().mockResolvedValue({
    lines: [],
    gone: [],
    total: 0,
    count: 0,
    hasShortage: false,
  });
  controller = new CartController({ preview } as unknown as CartService);
});

/** Позиции, с которыми контроллер сходил в сервис после разбора тела. */
async function ask(items: unknown): Promise<CartItemInput[]> {
  await controller.preview({ items });
  return preview.mock.calls.at(-1)?.[0] as CartItemInput[];
}

describe("CartController.preview — разбор тела", () => {
  it("пропускает нормальную позицию", async () => {
    expect(await ask([{ slug: "sviter-saharok", size: "S", color: "Сливочный", quantity: 2 }]))
      .toEqual([{ slug: "sviter-saharok", size: "S", color: "Сливочный", quantity: 2 }]);
  });

  it("на отсутствующий и не-массивный items считает корзину пустой", async () => {
    expect(await ask(undefined)).toEqual([]);
    expect(await ask("что-то")).toEqual([]);
    expect(await ask({ slug: "x" })).toEqual([]);
  });

  // Корзина — не форма: ругаться на неё покупателю бессмысленно, но и считать
  // по мусору нельзя, поэтому непонятные позиции молча выбрасываются.
  it("выбрасывает позиции, которые не похожи на позицию", async () => {
    expect(await ask(["строка", null, 42, {}, { slug: "x" }])).toEqual([]);
  });

  it("выбрасывает размер вне сетки магазина", async () => {
    expect(await ask([{ slug: "x", size: "XXL", quantity: 1 }])).toEqual([]);
    expect(await ask([{ slug: "x", size: "s", quantity: 1 }])).toEqual([]);
  });

  it("выбрасывает пустой слаг", async () => {
    expect(await ask([{ slug: "   ", size: "S", quantity: 1 }])).toEqual([]);
  });

  it("выбрасывает нулевое, отрицательное и нечисловое количество", async () => {
    expect(await ask([{ slug: "x", size: "S", quantity: 0 }])).toEqual([]);
    expect(await ask([{ slug: "x", size: "S", quantity: -2 }])).toEqual([]);
    expect(await ask([{ slug: "x", size: "S", quantity: "две" }])).toEqual([]);
  });

  // Иначе `quantity: 1e9` доехал бы до умножения на цену и дал бессмысленный итог.
  it("режет количество по лимиту позиции", async () => {
    expect(await ask([{ slug: "x", size: "S", quantity: 1e9 }])).toMatchObject([{ quantity: 10 }]);
  });

  it("округляет дробное количество вниз", async () => {
    expect(await ask([{ slug: "x", size: "S", quantity: 2.9 }])).toMatchObject([{ quantity: 2 }]);
  });

  it("подрезает слаг и расцветку по краям, пустую расцветку не отправляет", async () => {
    expect(await ask([{ slug: "  x  ", size: "S", color: "  Графит ", quantity: 1 }]))
      .toEqual([{ slug: "x", size: "S", color: "Графит", quantity: 1 }]);
    expect(await ask([{ slug: "x", size: "S", color: "   ", quantity: 1 }]))
      .toEqual([{ slug: "x", size: "S", quantity: 1 }]);
  });

  it("не пересчитывает корзину длиннее лимита целиком", async () => {
    const many = Array.from({ length: 80 }, (_, index) => ({
      slug: `p${index}`,
      size: "S",
      quantity: 1,
    }));

    expect(await ask(many)).toHaveLength(50);
  });
});
