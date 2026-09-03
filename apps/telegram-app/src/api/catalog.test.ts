// @vitest-environment jsdom
// Стор сессии персистится в `localStorage`, поэтому здесь нужен DOM.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogResponse } from "@mikki-shop/shared-types";
import {
  HttpError,
  fetchCartPreview,
  fetchCategories,
  fetchProduct,
  fetchProducts,
  login,
} from "./catalog";
import { useAuth } from "../lib/auth";

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
  useAuth.setState({ token: null, expiresAt: null, user: null });
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
    // Не `toEqual`: рядом с сигналом едут заголовки, и проверяется здесь
    // именно отмена запроса.
    expect(fetchMock.mock.calls.at(-1)?.[1]).toMatchObject({ signal: controller.signal });
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

describe("fetchProduct", () => {
  it("ходит за карточкой по слагу", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    await fetchProduct("sviter-saharok");
    expect(requestedUrl()).toBe("/catalog/products/sviter-saharok");
  });

  // Слаг приходит из адресной строки: без кодирования кириллица или слэш в нём
  // ушли бы в путь как есть и увели запрос не туда.
  it("кодирует слаг в пути", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    await fetchProduct("свитер/сахарок");
    expect(requestedUrl()).toBe("/catalog/products/%D1%81%D0%B2%D0%B8%D1%82%D0%B5%D1%80%2F%D1%81%D0%B0%D1%85%D0%B0%D1%80%D0%BE%D0%BA");
  });

  // Экран товара по коду отличает «такого товара нет» от обрыва связи, поэтому
  // код обязан доезжать до него, а не теряться в тексте ошибки.
  it("на 404 бросает HttpError с кодом", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    await expect(fetchProduct("net")).rejects.toBeInstanceOf(HttpError);
    await expect(fetchProduct("net")).rejects.toMatchObject({ status: 404 });
  });
});

describe("токен покупателя в запросах", () => {
  it("не шлёт заголовок, пока покупатель не вошёл", async () => {
    useAuth.setState({ token: null, expiresAt: null, user: null });
    await fetchProducts({});

    const init = fetchMock.mock.calls.at(-1)?.[1] as { headers?: Record<string, string> };
    expect(init?.headers).not.toHaveProperty("Authorization");
  });

  it("подставляет токен вошедшего", async () => {
    useAuth.setState({
      token: "signed.jwt.token",
      expiresAt: Date.now() + 60 * 60 * 1000,
      user: { id: "u1", telegramId: "1", isPremium: false },
    });
    await fetchProducts({});

    const init = fetchMock.mock.calls.at(-1)?.[1] as { headers?: Record<string, string> };
    expect(init?.headers?.Authorization).toBe("Bearer signed.jwt.token");
  });

  it("не теряет Content-Type на POST", async () => {
    useAuth.setState({
      token: "signed.jwt.token",
      expiresAt: Date.now() + 60 * 60 * 1000,
      user: { id: "u1", telegramId: "1", isPremium: false },
    });
    await fetchCartPreview([]);

    const init = fetchMock.mock.calls.at(-1)?.[1] as { headers?: Record<string, string> };
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer signed.jwt.token",
    });
  });

  // Истёкший токен всё равно даст 401: слать его — лишний круг.
  it("не шлёт истёкший токен", async () => {
    useAuth.setState({
      token: "старый",
      expiresAt: Date.now() - 1000,
      user: { id: "u1", telegramId: "1", isPremium: false },
    });
    await fetchProducts({});

    const init = fetchMock.mock.calls.at(-1)?.[1] as { headers?: Record<string, string> };
    expect(init?.headers).not.toHaveProperty("Authorization");
  });
});

describe("login", () => {
  it("меняет initData на сессию", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    await login("user=%7B%22id%22%3A1%7D&hash=abc");

    expect(requestedUrl()).toBe("/auth/telegram");
    const init = fetchMock.mock.calls.at(-1)?.[1] as { method?: string; body?: string };
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body ?? "{}")).toEqual({
      initData: "user=%7B%22id%22%3A1%7D&hash=abc",
    });
  });
});

describe("сервер не принял токен", () => {
  function withSession() {
    useAuth.setState({
      token: "signed.jwt.token",
      expiresAt: Date.now() + 60 * 60 * 1000,
      user: { id: "u1", telegramId: "1", isPremium: false },
    });
  }

  // Годность токена на клиенте меряется только его же `expiresAt`, а сервер
  // может отказать раньше: сменился секрет, пропала строка покупателя. Без
  // сброса сессия залипла бы мёртвой до конца месячного срока.
  it("на 401 забывает сессию", async () => {
    withSession();
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });

    await expect(fetchProducts({})).rejects.toMatchObject({ status: 401 });
    expect(useAuth.getState().token).toBeNull();
  });

  it("на 401 в POST тоже забывает", async () => {
    withSession();
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });

    await expect(fetchCartPreview([])).rejects.toMatchObject({ status: 401 });
    expect(useAuth.getState().token).toBeNull();
  });

  // Пропавший товар и сбой сервера к сессии отношения не имеют: выкидывать
  // покупателя из-за них — потерять корзину на ровном месте.
  it("на другие ошибки сессию не трогает", async () => {
    for (const status of [404, 500, 503]) {
      withSession();
      fetchMock.mockResolvedValue({ ok: false, status, json: async () => ({}) });

      await expect(fetchProduct("net")).rejects.toMatchObject({ status });
      expect(useAuth.getState().token).toBe("signed.jwt.token");
    }
  });
});
