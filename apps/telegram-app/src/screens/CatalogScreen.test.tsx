// @vitest-environment jsdom
// Матчеры вроде `toBeDisabled` подключаются здесь, а не глобальным setup-файлом:
// это единственный тест в монорепо, которому нужен DOM.
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type {
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
import { CatalogScreen } from "./CatalogScreen";

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

function catalogOf(count: number): CatalogProduct[] {
  return Array.from({ length: count }, (_, index) => product(index + 1));
}

/** Подставной бэкенд: режет общий список на страницы так же, как настоящий. */
function serve(
  all: CatalogProduct[],
  options: {
    limit?: number;
    /** Всего в каталоге — отдельно от `matched`, как и у настоящего бэкенда. */
    total?: number;
  } = {},
) {
  const limit = options.limit ?? 8;
  products.mockImplementation(async (query: CatalogQuery): Promise<CatalogResponse> => {
    const offset = query.offset ?? 0;
    return {
      items: all.slice(offset, offset + limit),
      matched: all.length,
      total: options.total ?? all.length,
      offset,
      limit,
      sizes: [...GRID],
      availableSizes: [...GRID],
    };
  });
}

/** Запрос, с которым экран последний раз сходил за товарами. */
function lastQuery(): CatalogQuery {
  return products.mock.calls.at(-1)?.[0] as CatalogQuery;
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CatalogScreen />
    </QueryClientProvider>,
  );
}

/** Полоса «Показано N из M» под сеткой. */
function shown(): Promise<HTMLElement> {
  return screen.findByText(/^Показано \d+ из \d+$/);
}

beforeEach(() => {
  categories.mockResolvedValue([]);
  serve(catalogOf(28));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CatalogScreen — выдача", () => {
  it("рисует первую страницу и оба счётчика", async () => {
    // Под фильтр подошло 28 из 40 — счётчики не должны путаться местами.
    serve(catalogOf(28), { total: 40 });
    renderScreen();

    expect(await shown()).toHaveTextContent("Показано 8 из 28");
    // Подзаголовок шапки считает весь каталог, а не выдачу под фильтром.
    expect(screen.getByText("40 моделей")).toBeTruthy();
    expect(screen.getByText("Товар 1")).toBeTruthy();
    expect(screen.getByText("Товар 8")).toBeTruthy();
    expect(screen.queryByText("Товар 9")).toBeNull();
  });

  it("на пустой выдаче показывает не сетку, а объяснение", async () => {
    serve([]);
    renderScreen();

    expect(await screen.findByText("Ничего не нашлось")).toBeTruthy();
    expect(screen.queryByText(/^Показано/)).toBeNull();
  });
});

describe("CatalogScreen — «Показать ещё»", () => {
  it("догружает следующую страницу к уже показанным", async () => {
    renderScreen();
    await shown();

    fireEvent.click(screen.getByRole("button", { name: "Показать ещё 8" }));

    await waitFor(() => expect(screen.getByText("Товар 9")).toBeTruthy());
    // Страницы складываются, а не подменяют друг друга.
    expect(screen.getByText("Товар 1")).toBeTruthy();
    expect(await shown()).toHaveTextContent("Показано 16 из 28");
    expect(lastQuery().offset).toBe(8);
  });

  // Иначе кнопка обещала бы восемь товаров там, где осталось четыре.
  it("обещает остаток, когда он меньше страницы", async () => {
    serve(catalogOf(12));
    renderScreen();
    await shown();

    expect(screen.getByRole("button", { name: "Показать ещё 4" })).toBeTruthy();
  });

  it("не показывает кнопку, когда загружено всё", async () => {
    serve(catalogOf(5));
    renderScreen();
    await shown();

    expect(screen.queryByRole("button", { name: /Показать ещё/ })).toBeNull();
  });
});

describe("CatalogScreen — сбой сети", () => {
  it("показывает сообщение и повторяет запрос по кнопке", async () => {
    products.mockRejectedValueOnce(new Error("/catalog/products: HTTP 503"));
    renderScreen();

    expect(await screen.findByText("Каталог не загрузился")).toBeTruthy();

    serve(catalogOf(28));
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));

    expect(await shown()).toHaveTextContent("Показано 8 из 28");
    expect(screen.queryByText("Каталог не загрузился")).toBeNull();
  });
});

describe("CatalogScreen — фильтры", () => {
  it("переключает категорию и уходит с ней в запрос", async () => {
    categories.mockResolvedValue([{ key: "rain", label: "Дождевики", count: 5 }]);
    renderScreen();
    await shown();

    fireEvent.click(await screen.findByText("Дождевики"));

    await waitFor(() => expect(lastQuery().category).toBe("rain"));
  });

  it("сбрасывает фильтры с пустой выдачи", async () => {
    categories.mockResolvedValue([{ key: "rain", label: "Дождевики", count: 5 }]);
    renderScreen();
    await shown();

    serve([]);
    fireEvent.click(await screen.findByText("Дождевики"));
    fireEvent.click(await screen.findByText("Сбросить фильтры"));

    await waitFor(() => expect(lastQuery().category).toBe("all"));
  });

  // Размеры, которых нет в выборке, `SizeSelector` рисует `disabled`. Если так
  // же пометить уже выбранный размер, снять фильтр станет нечем: выдача пустая,
  // а кнопка не нажимается.
  it("не гасит выбранный размер, даже когда его нет в выборке", async () => {
    // Выбор M сужает выдачу до трёх товаров, среди которых остаётся только S.
    // По счётчику видно, что новый ответ уже отрисован: без этого проверка
    // читала бы старые размеры, которые экран держит на время загрузки
    // (`keepPreviousData`), и прошла бы при любой логике.
    products.mockImplementation(async (query: CatalogQuery): Promise<CatalogResponse> => {
      const narrowed = query.size === "M";
      const all = narrowed ? catalogOf(3) : catalogOf(28);
      return {
        items: all.slice(query.offset ?? 0, (query.offset ?? 0) + 8),
        matched: all.length,
        total: 28,
        offset: query.offset ?? 0,
        limit: 8,
        sizes: [...GRID],
        availableSizes: narrowed ? ["S"] : ["S", "M"],
      };
    });
    renderScreen();
    await shown();

    fireEvent.click(screen.getByRole("button", { name: "Фильтры" }));
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "XL" })).toBeDisabled();

    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "M" }));
    await screen.findByText("Показано 3 из 3");

    const sheet = within(screen.getByRole("dialog"));
    expect(sheet.getByRole("button", { name: "M" })).not.toBeDisabled();
    expect(sheet.getByRole("button", { name: "L" })).toBeDisabled();
  });
});

describe("CatalogScreen — поиск", () => {
  it("не бьёт в API на каждую букву, но доносит запрос", async () => {
    renderScreen();
    await shown();
    const before = products.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Поиск" }));
    fireEvent.change(screen.getByPlaceholderText("Свитер, дождевик, бандана"), {
      target: { value: "свитер" },
    });

    // Дебаунс 300 мс: сразу после ввода запроса ещё нет.
    expect(products.mock.calls.length).toBe(before);
    await waitFor(() => expect(lastQuery().q).toBe("свитер"));
  });

  it("очищает крестиком и поле, и выдачу", async () => {
    renderScreen();
    await shown();

    fireEvent.click(screen.getByRole("button", { name: "Поиск" }));
    fireEvent.change(screen.getByPlaceholderText("Свитер, дождевик, бандана"), {
      target: { value: "свитер" },
    });
    await waitFor(() => expect(lastQuery().q).toBe("свитер"));

    fireEvent.click(screen.getByRole("button", { name: "Очистить поиск" }));

    expect(screen.getByPlaceholderText("Свитер, дождевик, бандана")).toHaveValue("");
    await waitFor(() => expect(lastQuery().q).toBe(""));
  });

  // Спрятанное поле с живым фильтром — выдача урезана, а на экране ничто этого
  // не объясняет.
  it("снимает фильтр, когда поле сворачивают", async () => {
    renderScreen();
    await shown();

    fireEvent.click(screen.getByRole("button", { name: "Поиск" }));
    fireEvent.change(screen.getByPlaceholderText("Свитер, дождевик, бандана"), {
      target: { value: "свитер" },
    });
    await waitFor(() => expect(lastQuery().q).toBe("свитер"));

    fireEvent.click(screen.getByRole("button", { name: "Поиск" }));

    expect(screen.queryByPlaceholderText("Свитер, дождевик, бандана")).toBeNull();
    await waitFor(() => expect(lastQuery().q).toBe(""));
  });
});

describe("CatalogScreen — переход в карточку", () => {
  it("по клику на плитку открывает товар по его слагу", () => {
    window.location.hash = "";
    serve(catalogOf(3));
    renderScreen();

    return waitFor(() => screen.getByText("Товар 1")).then(() => {
      fireEvent.click(screen.getByText("Товар 1"));
      expect(window.location.hash).toBe("#/product/product-1");
    });
  });

  // Сердечко живёт поверх плитки и не должно утаскивать в карточку по дороге.
  it("клик по сердечку не открывает карточку", async () => {
    window.location.hash = "";
    serve(catalogOf(3));
    renderScreen();
    await waitFor(() => screen.getByText("Товар 1"));

    fireEvent.click(screen.getAllByRole("button", { name: "В избранное" })[0]!);

    expect(window.location.hash).toBe("");
  });
});
