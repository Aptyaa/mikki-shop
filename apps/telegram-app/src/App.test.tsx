// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import type {
  CatalogCategory,
  CatalogProduct,
  CatalogResponse,
  ProductDetail,
} from "@mikki-shop/shared-types";

// Подменяется только сеть; `HttpError` берётся настоящий — карточка товара
// отличает по нему 404 от обрыва связи.
vi.mock("./api/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api/catalog")>()),
  fetchCategories: vi.fn(),
  fetchProducts: vi.fn(),
  fetchProduct: vi.fn(),
  fetchCartPreview: vi.fn(),
  fetchOrders: vi.fn(),
  login: vi.fn(),
  createOrder: vi.fn(),
}));

import { fetchCategories, fetchProduct, fetchProducts } from "./api/catalog";
import { App } from "./App";
import { navigate } from "./lib/route";

const CATEGORIES: CatalogCategory[] = [{ key: "rain", label: "Дождевики", count: 2 }];

const ITEM: CatalogProduct = {
  id: "p1",
  slug: "dozhdevik-luzha",
  category: "rain",
  title: "Дождевик «Лужа»",
  price: 1890,
  sizes: ["S", "M"],
  soldOut: false,
};

const RESPONSE: CatalogResponse = {
  items: [ITEM],
  matched: 1,
  total: 1,
  offset: 0,
  limit: 8,
  sizes: ["XS", "S", "M", "L", "XL"],
  availableSizes: ["S", "M"],
};

const DETAIL: ProductDetail = {
  ...ITEM,
  categoryLabel: "Дождевики",
  reviewCount: 0,
  photos: [],
  colors: [],
  sizeRows: [{ size: "S", available: true }],
};

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

/**
 * Узел экрана, а не факт его наличия: скрытые слои остаются в DOM, и проверять
 * их надо матчером `toBeVisible` — он смотрит на `visibility` у родителей.
 */
function node(text: string): HTMLElement {
  const found = screen.queryAllByText(text)[0];
  if (!found) throw new Error(`на экране нет текста «${text}»`);
  return found;
}

beforeEach(() => {
  window.location.hash = "";
  window.localStorage.clear();
  vi.mocked(fetchCategories).mockResolvedValue(CATEGORIES);
  vi.mocked(fetchProducts).mockResolvedValue(RESPONSE);
  vi.mocked(fetchProduct).mockResolvedValue(DETAIL);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("App — роутинг", () => {
  it("на корне показывает стартовый экран, а не каталог", async () => {
    renderApp();

    expect(await screen.findByText("Одежда для маленьких собак")).toBeTruthy();
    expect(screen.queryByText("Каталог")).toBeNull();
  });

  /**
   * Регрессия на живой баг React 18 (`react@18.3.1`): render-phase-обновление
   * состояния в том же компоненте, где стоит `useSyncExternalStore`, рвёт
   * подписку хука, и следующая смена адреса до роутера уже не доходит.
   *
   * Раньше App запоминал последний слаг через `setState` во время рендера, и
   * это ломало навигацию ровно после первого захода в карточку: адрес
   * возвращался на каталог, а на экране оставалась карточка. Проверяется
   * именно отрисованное, а не `window.location.hash`: хэш-то как раз менялся.
   */
  it("после открытия карточки продолжает слушать адрес", async () => {
    renderApp();
    await screen.findByText("Одежда для маленьких собак");

    act(() => navigate({ name: "catalog" }));
    expect(await screen.findByText("Каталог")).toBeTruthy();

    // Первый заход в карточку — тот самый момент, где рвалась подписка.
    act(() => navigate({ name: "product", slug: ITEM.slug }));
    // «Таблица размеров» есть только на карточке товара.
    await screen.findByText("Таблица размеров");

    act(() => navigate({ name: "catalog" }));
    expect(node("Каталог")).toBeVisible();
    expect(node("Таблица размеров")).not.toBeVisible();

    act(() => navigate({ name: "home" }));
    expect(node("Одежда для маленьких собак")).toBeVisible();
    expect(node("Каталог")).not.toBeVisible();
  });

  it("каталог не запрашивает выдачу, пока в него не зашли", async () => {
    renderApp();
    await screen.findByText("Одежда для маленьких собак");

    // Стартовый экран просит только свой ряд новинок.
    expect(vi.mocked(fetchProducts).mock.calls.every(([query]) => query.sort === "new")).toBe(true);

    act(() => navigate({ name: "catalog" }));
    await screen.findByText("Каталог");
    expect(vi.mocked(fetchProducts).mock.calls.some(([query]) => query.sort !== "new")).toBe(true);
  });

  it("открывает каталог на категории, выбранной на старте", async () => {
    renderApp();
    await screen.findByText("Одежда для маленьких собак");

    act(() => navigate({ name: "catalog", category: "rain" }));
    await screen.findByText("Каталог");

    const asked = vi.mocked(fetchProducts).mock.calls.map(([query]) => query.category);
    expect(asked).toContain("rain");
  });
});
