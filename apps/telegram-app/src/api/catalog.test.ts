import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogResponse } from "@mikki-shop/shared-types";
import { fetchCategories, fetchProducts } from "./catalog";

const PAGE: CatalogResponse = {
  items: [],
  matched: 0,
  total: 0,
  offset: 0,
  limit: 8,
  sizes: ["XS", "S", "M", "L", "XL"],
  availableSizes: [],
};

let fetchMock: ReturnType<typeof vi.fn>;

/** URL, с которым ушёл запрос. */
function requestedUrl(): string {
  return fetchMock.mock.calls.at(-1)?.[0] as string;
}

/** Query-часть URL, разобранная в объект. */
function requestedParams(): Record<string, string> {
  const [, search = ""] = requestedUrl().split("?");
  return Object.fromEntries(new URLSearchParams(search));
}

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => PAGE,
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchProducts", () => {
  it("без фильтров ходит по голому пути, без пустого «?»", async () => {
    await fetchProducts({});
    expect(requestedUrl()).toBe("/catalog/products");
  });

  it("отдаёт распарсенный ответ", async () => {
    await expect(fetchProducts({})).resolves.toEqual(PAGE);
  });

  it("кладёт фильтры в query", async () => {
    await fetchProducts({ category: "rain", size: "M", sort: "cheap", q: "дождевик" });
    expect(requestedParams()).toEqual({
      category: "rain",
      size: "M",
      sort: "cheap",
      q: "дождевик",
    });
  });

  // «Всё» — псевдокатегория экрана, а не ключ в БД: бэкенд про неё не знает и
  // на `category=all` честно вернул бы пустую выдачу.
  it("не отправляет псевдокатегорию «all»", async () => {
    await fetchProducts({ category: "all" });
    expect(requestedUrl()).toBe("/catalog/products");
  });

  it("не отправляет пустой поиск", async () => {
    await fetchProducts({ q: "" });
    expect(requestedUrl()).toBe("/catalog/products");
  });

  // Нулевое смещение — это и есть дефолт бэкенда, слать его незачем. А вот
  // limit отправляется даже нулевым: `limit` и `offset` здесь проверяются
  // по-разному намеренно.
  it("опускает нулевое смещение, но не нулевой limit", async () => {
    await fetchProducts({ offset: 0, limit: 0 });
    expect(requestedParams()).toEqual({ limit: "0" });
  });

  it("отправляет смещение следующей страницы", async () => {
    await fetchProducts({ offset: 8, limit: 8 });
    expect(requestedParams()).toEqual({ limit: "8", offset: "8" });
  });

  it("прокидывает AbortSignal в fetch", async () => {
    const controller = new AbortController();
    await fetchProducts({}, controller.signal);
    expect(fetchMock.mock.calls.at(-1)?.[1]).toEqual({ signal: controller.signal });
  });

  it("на не-2xx бросает ошибку с путём и кодом", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    await expect(fetchProducts({})).rejects.toThrow("/catalog/products: HTTP 503");
  });
});

describe("fetchCategories", () => {
  it("ходит за категориями без query", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    await fetchCategories();
    expect(requestedUrl()).toBe("/catalog/categories");
  });

  it("на не-2xx бросает ошибку с путём и кодом", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(fetchCategories()).rejects.toThrow("/catalog/categories: HTTP 500");
  });
});
