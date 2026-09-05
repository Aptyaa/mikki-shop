// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
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

/**
 * Примета каталога.
 *
 * По заголовку шапки его больше не отличить: в нижнем баре есть вкладка
 * «Каталог», и текст стал неоднозначным. Берём псевдокатегорию «Всё» — она
 * бывает только в его ряду категорий (у главной действие называется «всё →»,
 * это другой текст).
 *
 * Ищется по тексту, а не по роли: `*ByRole` не видит того, что спрятано через
 * `visibility`, — а проверять надо в том числе «каталог смонтирован, но не
 * показан», ровно ради чего слои и заведены.
 */
function catalogMark(): HTMLElement {
  return node("Всё");
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
    // Каталог ещё не смонтирован — его приметы на экране нет.
    expect(screen.queryByText("Всё")).toBeNull();
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
    await waitFor(() => expect(catalogMark()).toBeVisible());

    // Первый заход в карточку — тот самый момент, где рвалась подписка.
    act(() => navigate({ name: "product", slug: ITEM.slug }));
    // «Таблица размеров» есть только на карточке товара.
    await screen.findByText("Таблица размеров");

    act(() => navigate({ name: "catalog" }));
    expect(catalogMark()).toBeVisible();
    expect(node("Таблица размеров")).not.toBeVisible();

    act(() => navigate({ name: "home" }));
    expect(node("Одежда для маленьких собак")).toBeVisible();
    expect(catalogMark()).not.toBeVisible();
  });

  it("каталог не запрашивает выдачу, пока в него не зашли", async () => {
    renderApp();
    await screen.findByText("Одежда для маленьких собак");

    // Стартовый экран просит только свой ряд новинок.
    expect(vi.mocked(fetchProducts).mock.calls.every(([query]) => query.sort === "new")).toBe(true);

    act(() => navigate({ name: "catalog" }));
    await waitFor(() => expect(catalogMark()).toBeVisible());
    expect(vi.mocked(fetchProducts).mock.calls.some(([query]) => query.sort !== "new")).toBe(true);
  });

  /**
   * Каталог оставлен смонтированным ради поиска, фильтров, подгруженных
   * страниц и прокрутки. Из корзины, заказов, чекаута и карточки «товара
   * нет» возвращаются на `#/catalog` без категории — если бы такой переход
   * менял `key`, весь смысл этого пропадал бы.
   */
  it("возврат «в каталог» без категории не сбрасывает состояние экрана", async () => {
    renderApp();
    await screen.findByText("Одежда для маленьких собак");

    act(() => navigate({ name: "catalog", category: "rain" }));
    await waitFor(() => expect(catalogMark()).toBeVisible());

    // Что-нибудь, что живёт только в состоянии экрана каталога.
    act(() => {
      screen.getByRole("button", { name: "Поиск" }).click();
    });
    expect(screen.getByPlaceholderText("Свитер, дождевик, бандана")).toBeVisible();

    act(() => navigate({ name: "cart" }));
    await screen.findByText("В корзине пока пусто");

    act(() => navigate({ name: "catalog" }, { replace: true }));
    expect(screen.getByPlaceholderText("Свитер, дождевик, бандана")).toBeVisible();
  });

  it("открывает каталог на категории, выбранной на старте", async () => {
    renderApp();
    await screen.findByText("Одежда для маленьких собак");

    act(() => navigate({ name: "catalog", category: "rain" }));
    await waitFor(() => expect(catalogMark()).toBeVisible());

    const asked = vi.mocked(fetchProducts).mock.calls.map(([query]) => query.category);
    expect(asked).toContain("rain");
  });
});
