import { describe, expect, it } from "vitest";
import { parseRoute, routeToHash } from "./route";

describe("parseRoute", () => {
  it("пустой хэш и корень — это каталог", () => {
    expect(parseRoute("")).toEqual({ name: "catalog" });
    expect(parseRoute("#/")).toEqual({ name: "catalog" });
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

  it("не заглатывает хвост после слага", () => {
    expect(parseRoute("#/product/luzha/otzyvy")).toMatchObject({ slug: "luzha" });
    expect(parseRoute("#/product/luzha?utm=tiktok")).toMatchObject({ slug: "luzha" });
  });

  // Адресную строку правит кто угодно, а белый экран из-за неё — не вариант.
  it("на неизвестный и битый адрес отдаёт каталог", () => {
    expect(parseRoute("#/koroblya")).toEqual({ name: "catalog" });
    expect(parseRoute("#/product/")).toEqual({ name: "catalog" });
    expect(parseRoute("#/product/%E0%A4%A")).toEqual({ name: "catalog" });
  });
});

describe("routeToHash", () => {
  it("собирает адрес обратно", () => {
    expect(routeToHash({ name: "catalog" })).toBe("#/");
    expect(routeToHash({ name: "product", slug: "sviter-saharok" })).toBe(
      "#/product/sviter-saharok",
    );
  });

  it("кодирует слаг, чтобы адрес пережил пересылку", () => {
    expect(routeToHash({ name: "product", slug: "свитер" })).toBe(
      "#/product/%D1%81%D0%B2%D0%B8%D1%82%D0%B5%D1%80",
    );
  });

  // Иначе ссылка на товар, разобранная и собранная обратно, вела бы в никуда.
  it("переживает разбор и сборку", () => {
    const hash = routeToHash({ name: "product", slug: "свитер-сахарок" });
    expect(parseRoute(hash)).toEqual({ name: "product", slug: "свитер-сахарок" });
  });
});
