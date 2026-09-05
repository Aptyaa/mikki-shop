// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type {
  CatalogCategory,
  CatalogProduct,
  CatalogQuery,
  CatalogResponse,
  CatalogSize,
} from "@mikki-shop/shared-types";

// Экран проверяется целиком, вместе с дизайн-системой: подменяется только
// сеть. Клиент каталога покрыт отдельно в `api/catalog.test.ts`.
vi.mock("../api/catalog", () => ({
  fetchCategories: vi.fn(),
  fetchProducts: vi.fn(),
}));

import { fetchCategories, fetchProducts } from "../api/catalog";
import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart";
import { HomeScreen } from "./HomeScreen";

const products = vi.mocked(fetchProducts);
const categories = vi.mocked(fetchCategories);

const GRID: CatalogSize[] = ["XS", "S", "M", "L", "XL"];

function product(index: number): CatalogProduct {
  return {
    id: `p${index}`,
    slug: `product-${index}`,
    category: "sweaters",
    title: `Товар ${index}`,
    price: 1000 + index,
    sizes: ["S", "M"],
    soldOut: false,
  };
}

const CATEGORIES: CatalogCategory[] = [
  { key: "sweaters", label: "Свитеры", count: 12 },
  { key: "rain", label: "Дождевики", count: 4 },
];

function serve(items: CatalogProduct[], total = 40) {
  products.mockImplementation(async (query: CatalogQuery): Promise<CatalogResponse> => ({
    items,
    matched: items.length,
    total,
    offset: 0,
    limit: query.limit ?? 4,
    sizes: [...GRID],
    availableSizes: [...GRID],
  }));
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HomeScreen />
    </QueryClientProvider>,
  );
}

function signIn(firstName?: string) {
  useAuth.setState({
    token: "signed.jwt.token",
    expiresAt: Date.now() + 60 * 60 * 1000,
    user: { id: "u1", telegramId: "1", firstName, isPremium: false },
  });
}

beforeEach(() => {
  window.location.hash = "";
  window.localStorage.clear();
  useAuth.setState({ token: null, expiresAt: null, user: null });
  useCart.setState({ items: [] });
  categories.mockResolvedValue(CATEGORIES);
  serve([product(1), product(2)]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("HomeScreen — витрина", () => {
  it("показывает знак магазина и уводит в каталог по кнопке", async () => {
    renderScreen();

    expect(screen.getByRole("img", { name: "Микки Шоп" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Смотреть каталог/ }));
    expect(window.location.hash).toBe("#/catalog");
  });

  it("здоровается по имени, когда вход состоялся", async () => {
    signIn("Денис");
    renderScreen();

    expect(await screen.findByText("Привет, Денис")).toBeTruthy();
  });

  // Гостю здороваться не с кем: Telegram имени ещё не назвал.
  it("гостю показывает, чем занимается магазин", () => {
    renderScreen();

    expect(screen.getByText("Одежда для маленьких собак")).toBeTruthy();
    expect(screen.queryByText(/Привет,/)).toBeNull();
  });

  // Полоса несёт число из ответа каталога, а не выдуманное обещание.
  it("в полосе показывает, сколько всего моделей в каталоге", async () => {
    serve([product(1)], 41);
    renderScreen();

    expect(await screen.findByText("41 модель")).toBeTruthy();
  });

  /**
   * Корзина, профиль и каталог переехали в нижний бар, и дублировать их
   * кнопками в шапке незачем: два способа сделать одно и то же под одним
   * пальцем — это не забота, а вопрос «а эта куда».
   */
  it("не дублирует вкладки кнопками в шапке", () => {
    signIn();
    renderScreen();

    const bar = screen.getByRole("navigation");
    expect(within(bar).getByRole("button", { name: /Корзина/ })).toBeTruthy();
    // Вне бара кнопки корзины на экране нет.
    expect(
      screen.getAllByRole("button", { name: /Корзина/ }).filter((node) => !bar.contains(node)),
    ).toHaveLength(0);
  });

  it("показывает счётчик корзины в баре и ведёт в неё", () => {
    useCart.setState({
      items: [{ slug: "product-1", size: "M", quantity: 3 }],
    });
    renderScreen();

    // Счётчик ищется внутри самой вкладки: «3» на экране есть и у третьего
    // шага онбординга.
    const cart = within(screen.getByRole("navigation")).getByRole("button", { name: /Корзина/ });
    expect(within(cart).getByText("3")).toBeTruthy();

    fireEvent.click(cart);
    expect(window.location.hash).toBe("#/cart");
  });

  it("ведёт в профиль из бара", () => {
    signIn();
    renderScreen();

    fireEvent.click(
      within(screen.getByRole("navigation")).getByRole("button", { name: /Профиль/ }),
    );
    expect(window.location.hash).toBe("#/profile");
  });
});

describe("HomeScreen — онбординг", () => {
  it("первому входу показывает шаги раскрытыми", () => {
    renderScreen();

    expect(screen.getByText("Снимите мерки")).toBeVisible();
    expect(screen.getByRole("button", { name: /Как это работает/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  // Иначе покупатель узнавал бы об отсутствии оплаты на кнопке «Оформить заказ».
  it("предупреждает, что оплаты в приложении нет", () => {
    renderScreen();

    expect(screen.getByText(/Оплаты в приложении пока нет/)).toBeTruthy();
  });

  it("сворачивается и запоминает это между запусками", () => {
    renderScreen();

    fireEvent.click(screen.getByRole("button", { name: /Как это работает/ }));
    expect(screen.getByText("Снимите мерки")).not.toBeVisible();

    // Второй запуск приложения: экран смонтирован заново, хранилище то же.
    cleanup();
    renderScreen();
    expect(screen.getByText("Снимите мерки")).not.toBeVisible();
  });

  it("разворачивается обратно и это тоже запоминает", () => {
    window.localStorage.setItem("mikki-intro-collapsed", "1");
    renderScreen();
    expect(screen.getByText("Снимите мерки")).not.toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Как это работает/ }));
    expect(screen.getByText("Снимите мерки")).toBeVisible();

    cleanup();
    renderScreen();
    expect(screen.getByText("Снимите мерки")).toBeVisible();
  });
});

describe("HomeScreen — категории", () => {
  it("ведёт в каталог с выбранной категорией в адресе", async () => {
    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: /Свитеры/ }));
    expect(window.location.hash).toBe("#/catalog?category=sweaters");
  });

  // Об одном сбое API говорит блок новинок; второе сообщение рядом ничего
  // не добавляет — так же устроен и каталог.
  it("на ошибке справочника молчит, а не рисует пустой ряд", async () => {
    categories.mockRejectedValue(new Error("нет сети"));
    renderScreen();

    await waitFor(() => expect(categories).toHaveBeenCalled());
    expect(screen.queryByText("Категории")).toBeNull();
  });
});

describe("HomeScreen — новинки", () => {
  it("просит у бэкенда именно новинки и ровно один ряд", async () => {
    renderScreen();

    await waitFor(() => expect(products).toHaveBeenCalled());
    expect(products.mock.calls[0]?.[0]).toMatchObject({ sort: "new", limit: 4 });
  });

  it("открывает товар по клику на плитку", async () => {
    renderScreen();

    fireEvent.click(await screen.findByText("Товар 1"));
    expect(window.location.hash).toBe("#/product/product-1");
  });

  // Избранное в каталоге живёт в локальном состоянии и не переживает
  // перезагрузку: второе такое же место множило бы состояние, которого нет.
  it("не рисует сердечки", async () => {
    renderScreen();

    await screen.findByText("Товар 1");
    expect(screen.queryByRole("button", { name: "В избранное" })).toBeNull();
  });

  it("на ошибке предлагает повторить и повторяет", async () => {
    products.mockRejectedValueOnce(new Error("нет сети"));
    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: "Повторить" }));

    expect(await screen.findByText("Товар 1")).toBeTruthy();
  });
});
