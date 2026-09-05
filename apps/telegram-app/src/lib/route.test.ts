import { describe, expect, it } from "vitest";
import { parseRoute, routeToHash } from "./route";

describe("parseRoute", () => {
  it("пустой хэш и корень — это стартовый экран", () => {
    expect(parseRoute("")).toEqual({ name: "home" });
    expect(parseRoute("#/")).toEqual({ name: "home" });
  });

  it("разбирает адрес каталога", () => {
    expect(parseRoute("#/catalog")).toEqual({ name: "catalog" });
  });

  it("достаёт из адреса каталога категорию", () => {
    expect(parseRoute("#/catalog?category=sweaters")).toEqual({
      name: "catalog",
      category: "sweaters",
    });
  });

  // Пустая категория — это «весь каталог», а не категория с пустым ключом:
  // иначе выдача ушла бы фильтроваться по строке, которой нет в справочнике.
  it("пустую категорию не считает фильтром", () => {
    expect(parseRoute("#/catalog?category=")).toEqual({ name: "catalog" });
    expect(parseRoute("#/catalog?category=%20")).toEqual({ name: "catalog" });
  });

  it("разбирает адрес карточки товара", () => {
    expect(parseRoute("#/product/sviter-saharok")).toEqual({
      name: "product",
      slug: "sviter-saharok",
    });
  });

  it("раскодирует слаг", () => {
    expect(parseRoute("#/product/%D1%81%D0%B2%D0%B8%D1%82%D0%B5%D1%80")).toEqual({
      name: "product",
      slug: "свитер",
    });
  });

  it("разбирает адрес корзины", () => {
    expect(parseRoute("#/cart")).toEqual({ name: "cart" });
    expect(parseRoute("#/cart?from=tile")).toEqual({ name: "cart" });
  });

  // Граница слова, а не просто префикс: «#/cartoon» — это не корзина.
  it("не считает корзиной адрес, который лишь начинается с cart", () => {
    expect(parseRoute("#/cartoon")).toEqual({ name: "home" });
  });

  // Каталог начинается с тех же четырёх букв, что и корзина.
  it("не путает каталог с корзиной", () => {
    expect(parseRoute("#/catalog")).toMatchObject({ name: "catalog" });
  });

  it("не заглатывает хвост после слага", () => {
    expect(parseRoute("#/product/luzha/otzyvy")).toMatchObject({ slug: "luzha" });
    expect(parseRoute("#/product/luzha?utm=tiktok")).toMatchObject({ slug: "luzha" });
  });

  // Адресную строку правит кто угодно, а белый экран из-за неё — не вариант.
  it("на неизвестный и битый адрес отдаёт стартовый экран", () => {
    expect(parseRoute("#/koroblya")).toEqual({ name: "home" });
    expect(parseRoute("#/product/")).toEqual({ name: "home" });
    expect(parseRoute("#/product/%E0%A4%A")).toEqual({ name: "home" });
  });

  // `URLSearchParams` не бросает на битом кодировании, но убедиться дешевле,
  // чем однажды получить белый экран из правленого руками адреса.
  it("переживает битую категорию в адресе", () => {
    expect(() => parseRoute("#/catalog?category=%E0%A4%A")).not.toThrow();
    expect(parseRoute("#/catalog?category=%E0%A4%A")).toMatchObject({ name: "catalog" });
  });
});

describe("routeToHash", () => {
  it("собирает адрес обратно", () => {
    expect(routeToHash({ name: "home" })).toBe("#/");
    expect(routeToHash({ name: "catalog" })).toBe("#/catalog");
    expect(routeToHash({ name: "cart" })).toBe("#/cart");
    expect(routeToHash({ name: "product", slug: "sviter-saharok" })).toBe(
      "#/product/sviter-saharok",
    );
  });

  it("кодирует слаг и категорию, чтобы адрес пережил пересылку", () => {
    expect(routeToHash({ name: "product", slug: "свитер" })).toBe(
      "#/product/%D1%81%D0%B2%D0%B8%D1%82%D0%B5%D1%80",
    );
    expect(routeToHash({ name: "catalog", category: "дождевики" })).toBe(
      "#/catalog?category=%D0%B4%D0%BE%D0%B6%D0%B4%D0%B5%D0%B2%D0%B8%D0%BA%D0%B8",
    );
  });

  // Иначе ссылка на товар или категорию, разобранная и собранная обратно,
  // вела бы в никуда.
  it("переживает разбор и сборку", () => {
    const product = routeToHash({ name: "product", slug: "свитер-сахарок" });
    expect(parseRoute(product)).toEqual({ name: "product", slug: "свитер-сахарок" });

    const catalog = routeToHash({ name: "catalog", category: "rain" });
    expect(parseRoute(catalog)).toEqual({ name: "catalog", category: "rain" });
  });
});
