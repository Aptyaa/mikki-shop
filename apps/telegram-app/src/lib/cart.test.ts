// @vitest-environment jsdom
// DOM нужен ради `localStorage`: стор персистится, и без него `zustand/persist`
// работал бы вхолостую, а тест на «переживает перезагрузку» был бы невозможен.
import { beforeEach, describe, expect, it } from "vitest";
import { CART_LINE_MAX, cartKey, toCartInput, useCart } from "./cart";

const SAHAROK = { slug: "sviter-saharok", size: "S", color: "Сливочный", quantity: 1 } as const;

beforeEach(() => {
  useCart.setState({ items: [] });
  window.localStorage.clear();
});

describe("cartKey", () => {
  // Один товар в двух размерах — две строки: иначе покупатель не сможет убрать
  // только один из них.
  it("различает позиции по размеру и расцветке", () => {
    expect(cartKey({ slug: "a", size: "S" })).not.toBe(cartKey({ slug: "a", size: "M" }));
    expect(cartKey({ slug: "a", size: "S", color: "Графит" })).not.toBe(
      cartKey({ slug: "a", size: "S", color: "Ягодный" }),
    );
    expect(cartKey({ slug: "a", size: "S" })).toBe(cartKey({ slug: "a", size: "S" }));
  });
});

describe("useCart.add", () => {
  it("кладёт позицию в корзину", () => {
    useCart.getState().add(SAHAROK);

    expect(useCart.getState().items).toEqual([SAHAROK]);
  });

  it("складывает количество, а не заводит вторую такую же строку", () => {
    useCart.getState().add(SAHAROK);
    useCart.getState().add({ ...SAHAROK, quantity: 2 });

    expect(useCart.getState().items).toEqual([{ ...SAHAROK, quantity: 3 }]);
  });

  it("разные размеры одного товара — разные строки", () => {
    useCart.getState().add(SAHAROK);
    useCart.getState().add({ ...SAHAROK, size: "M" });

    expect(useCart.getState().items).toHaveLength(2);
  });

  it("не даёт набрать больше лимита позиции", () => {
    useCart.getState().add({ ...SAHAROK, quantity: CART_LINE_MAX });
    useCart.getState().add({ ...SAHAROK, quantity: 5 });

    expect(useCart.getState().items[0]?.quantity).toBe(CART_LINE_MAX);
  });
});

describe("useCart.setQuantity", () => {
  it("меняет количество нужной строки", () => {
    useCart.getState().add(SAHAROK);
    useCart.getState().setQuantity(cartKey(SAHAROK), 4);

    expect(useCart.getState().items[0]?.quantity).toBe(4);
  });

  // Степпер и так не опускается ниже единицы, но состояние не должно уметь
  // хранить строку «ноль штук».
  it("нулевое количество убирает позицию", () => {
    useCart.getState().add(SAHAROK);
    useCart.getState().setQuantity(cartKey(SAHAROK), 0);

    expect(useCart.getState().items).toEqual([]);
  });

  it("режет по лимиту позиции", () => {
    useCart.getState().add(SAHAROK);
    useCart.getState().setQuantity(cartKey(SAHAROK), 99);

    expect(useCart.getState().items[0]?.quantity).toBe(CART_LINE_MAX);
  });
});

describe("useCart — уборка по ответу бэкенда", () => {
  it("dropMissing выкидывает товары, которых больше нет в каталоге", () => {
    useCart.getState().add(SAHAROK);
    useCart.getState().add({ slug: "net-takogo", size: "M", quantity: 1 });

    useCart.getState().dropMissing(["net-takogo"]);

    expect(useCart.getState().items.map((item) => item.slug)).toEqual(["sviter-saharok"]);
  });

  it("clampToStock приводит количество к остатку", () => {
    useCart.getState().add({ ...SAHAROK, quantity: 5 });
    useCart.getState().clampToStock({ [cartKey(SAHAROK)]: 2 });

    expect(useCart.getState().items[0]?.quantity).toBe(2);
  });

  it("clampToStock не трогает то, что и так помещается", () => {
    useCart.getState().add({ ...SAHAROK, quantity: 2 });
    useCart.getState().clampToStock({ [cartKey(SAHAROK)]: 5 });

    expect(useCart.getState().items[0]?.quantity).toBe(2);
  });

  // Молча удалить строку хуже, чем показать её с пометкой «этого размера нет»:
  // покупатель должен увидеть, что именно выпало, и убрать сам.
  it("clampToStock не удаляет позицию с нулевым остатком", () => {
    useCart.getState().add({ ...SAHAROK, quantity: 2 });
    useCart.getState().clampToStock({ [cartKey(SAHAROK)]: 0 });

    expect(useCart.getState().items).toHaveLength(1);
    expect(useCart.getState().items[0]?.quantity).toBe(2);
  });
});

describe("useCart — хранение", () => {
  it("пишет корзину в localStorage, чтобы она пережила перезагрузку", () => {
    useCart.getState().add(SAHAROK);

    const stored = window.localStorage.getItem("mikki-cart");
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored ?? "{}")).toMatchObject({
      state: { items: [SAHAROK] },
      version: 1,
    });
  });

  it("clear опустошает корзину", () => {
    useCart.getState().add(SAHAROK);
    useCart.getState().clear();

    expect(useCart.getState().items).toEqual([]);
  });
});

describe("toCartInput", () => {
  it("отдаёт бэкенду только то, что он должен знать", () => {
    expect(toCartInput([SAHAROK])).toEqual([
      { slug: "sviter-saharok", size: "S", color: "Сливочный", quantity: 1 },
    ]);
  });

  it("не отправляет пустую расцветку", () => {
    expect(toCartInput([{ slug: "a", size: "S", quantity: 1 }])).toEqual([
      { slug: "a", size: "S", quantity: 1 },
    ]);
  });
});
