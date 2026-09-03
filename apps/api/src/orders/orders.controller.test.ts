import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { toDraft } from "./orders.controller";

const ITEMS = [{ slug: "bandana-kletka", size: "M", quantity: 2 }];

function body(over: Record<string, unknown> = {}) {
  return {
    customerName: "Денис",
    phone: "+7 916 123-45-67",
    delivery: "pickup",
    consent: true,
    items: ITEMS,
    ...over,
  };
}

describe("toDraft — форма", () => {
  it("разбирает заполненную форму", () => {
    expect(
      toDraft(body({ delivery: "courier", address: " Москва, Тверская 1 ", comment: " Домофон 12 " })),
    ).toEqual({
      customerName: "Денис",
      phone: "+7 916 123-45-67",
      delivery: "courier",
      consent: true,
      address: "Москва, Тверская 1",
      comment: "Домофон 12",
      items: [{ slug: "bandana-kletka", size: "M", quantity: 2 }],
    });
  });

  // В отличие от корзины, здесь на плохих данных отвечаем ошибкой, а не молча
  // выбрасываем: это форма, и покупателю надо знать, что поправить.
  it("требует имя", () => {
    expect(() => toDraft(body({ customerName: "   " }))).toThrow(/Укажите имя/);
  });

  it("требует похожий на настоящий телефон", () => {
    expect(() => toDraft(body({ phone: "123" }))).toThrow(/телефон/);
    expect(() => toDraft(body({ phone: "" }))).toThrow(/телефон/);
    // Международные номера длиннее российских — маска не должна их резать.
    expect(toDraft(body({ phone: "+1 415 555 0132" })).phone).toBe("+1 415 555 0132");
  });

  it("требует известный способ получения", () => {
    expect(() => toDraft(body({ delivery: "телепорт" }))).toThrow(/способ получения/);
    expect(() => toDraft(body({ delivery: undefined }))).toThrow(/способ получения/);
  });

  it("требует адрес для курьера и почты", () => {
    expect(() => toDraft(body({ delivery: "courier" }))).toThrow(/адрес/);
    expect(() => toDraft(body({ delivery: "post" }))).toThrow(/адрес/);
  });

  it("самовывозу адрес не нужен и не сохраняется", () => {
    const draft = toDraft(body({ delivery: "pickup", address: "Москва" }));

    expect(draft.delivery).toBe("pickup");
    expect(draft).not.toHaveProperty("address");
  });

  // 152-ФЗ: без согласия персональные данные хранить нельзя, и проверять его
  // только галочкой на экране бессмысленно — запрос приходит не только оттуда.
  it("требует согласие на обработку персональных данных", () => {
    expect(() => toDraft(body({ consent: false }))).toThrow(/согласие/);
    expect(() => toDraft(body({ consent: undefined }))).toThrow(/согласие/);
    // Строка «true» согласием не считается: галочка либо стоит, либо нет.
    expect(() => toDraft(body({ consent: "true" }))).toThrow(/согласие/);
  });

  it("отказывает на пустой корзине", () => {
    expect(() => toDraft(body({ items: [] }))).toThrow(/Корзина пуста/);
    expect(() => toDraft(body({ items: "всё" }))).toThrow(/Корзина пуста/);
  });

  it("выбрасывает мусорные позиции, а не падает на них", () => {
    const draft = toDraft(body({ items: [...ITEMS, null, { slug: "x", size: "XXL", quantity: 1 }] }));

    expect(draft.items).toHaveLength(1);
  });

  it("режет длинные поля", () => {
    const draft = toDraft(
      body({ customerName: "и".repeat(500), comment: "к".repeat(5000), petName: "п".repeat(200) }),
    );

    expect(draft.customerName).toHaveLength(100);
    expect(draft.comment).toHaveLength(1000);
    expect(draft.petName).toHaveLength(60);
  });

  it("не отправляет пустые необязательные поля", () => {
    const draft = toDraft(body({ comment: "   ", petName: "" }));

    expect(draft).not.toHaveProperty("comment");
    expect(draft).not.toHaveProperty("petName");
  });
});
