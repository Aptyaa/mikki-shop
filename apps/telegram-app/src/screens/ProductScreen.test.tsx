// @vitest-environment jsdom
// Матчеры вроде `toBeDisabled` подключаются здесь, а не глобальным setup-файлом:
// DOM нужен только тестам экранов.
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { CatalogProduct, CatalogResponse, ProductDetail } from "@mikki-shop/shared-types";

// Подменяется только сеть: экран проверяется вместе с дизайн-системой.
// `HttpError` остаётся настоящим — по нему экран отличает 404 от обрыва связи.
vi.mock("../api/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/catalog")>()),
  fetchProduct: vi.fn(),
  fetchProducts: vi.fn(),
}));

import { HttpError, fetchProduct, fetchProducts } from "../api/catalog";
import { ProductScreen } from "./ProductScreen";

const product = vi.mocked(fetchProduct);
const products = vi.mocked(fetchProducts);

function card(over: Partial<ProductDetail> = {}): ProductDetail {
  return {
    id: "p1",
    slug: "sviter-saharok",
    category: "sweaters",
    categoryLabel: "Свитеры",
    title: "Вязаный свитер «Сахарок»",
    price: 1490,
    sizes: ["XS", "S", "M"],
    soldOut: false,
    reviewCount: 0,
    photos: [],
    colors: [],
    sizeRows: [
      { size: "XS", available: false, chest: "28–34", neck: "18–22", back: "20–24" },
      { size: "S", available: true, chest: "34–40", neck: "22–26", back: "24–28" },
      { size: "M", available: false, chest: "40–46", neck: "26–30", back: "28–33" },
    ],
    ...over,
  };
}

function tile(index: number, over: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: `s${index}`,
    slug: `sosed-${index}`,
    category: "sweaters",
    title: `Сосед ${index}`,
    price: 1000 + index,
    sizes: ["S"],
    soldOut: false,
    ...over,
  };
}

/** Подставная выдача каталога — её экран просит под блок «Похожие». */
function similar(items: CatalogProduct[]): CatalogResponse {
  return {
    items,
    matched: items.length,
    total: items.length,
    offset: 0,
    limit: items.length,
    sizes: ["XS", "S", "M", "L", "XL"],
    availableSizes: ["S"],
  };
}

function renderScreen(slug = "sviter-saharok") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProductScreen slug={slug} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.location.hash = "";
  product.mockResolvedValue(card());
  products.mockResolvedValue(similar([]));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProductScreen — карточка", () => {
  it("рисует категорию, название, цену и описание", async () => {
    product.mockResolvedValue(
      card({ was: 2190, description: "Плотная вязка в две нити.", composition: "меринос 70%" }),
    );
    renderScreen();

    expect(await screen.findByRole("heading", { name: "Вязаный свитер «Сахарок»" })).toBeTruthy();
    expect(screen.getByText("Свитеры")).toBeTruthy();
    expect(screen.getByText("1 490 ₽")).toBeTruthy();
    expect(screen.getByText("2 190 ₽")).toBeTruthy();
    expect(screen.getByText("Плотная вязка в две нити.")).toBeTruthy();
    expect(screen.getByText("меринос 70%")).toBeTruthy();
  });

  it("просит карточку по слагу из адреса", async () => {
    renderScreen("dozhdevik-luzha");

    await waitFor(() => expect(product).toHaveBeenCalled());
    expect(product.mock.calls[0]?.[0]).toBe("dozhdevik-luzha");
  });

  it("показывает заметку об остатке", async () => {
    product.mockResolvedValue(card({ stockNote: "Остался последний размер S" }));
    renderScreen();

    expect(await screen.findByText("Остался последний размер S")).toBeTruthy();
  });

  it("у распроданного товара пишет, что его нет", async () => {
    product.mockResolvedValue(card({ soldOut: true }));
    renderScreen();

    expect(await screen.findByText("нет в наличии")).toBeTruthy();
  });
});

describe("ProductScreen — рейтинг", () => {
  // Правило дизайн-системы: ниже трёх отзывов звёзд нет вовсе — одинокая
  // пятёрка от одного покупателя занимает место настоящего рейтинга.
  it("не показывает рейтинг, пока отзывов меньше трёх", async () => {
    product.mockResolvedValue(card({ rating: 5, reviewCount: 2 }));
    renderScreen();

    await screen.findByRole("heading", { name: /Сахарок/ });
    expect(screen.queryByText("5.0")).toBeNull();
    expect(screen.queryByText("(2)")).toBeNull();
  });

  it("показывает рейтинг начиная с трёх отзывов", async () => {
    product.mockResolvedValue(card({ rating: 4.8, reviewCount: 126 }));
    renderScreen();

    expect(await screen.findByText("4.8")).toBeTruthy();
    expect(screen.getByText("(126)")).toBeTruthy();
  });
});

describe("ProductScreen — размеры", () => {
  it("гасит размеры, которых нет в наличии, но оставляет их видимыми", async () => {
    renderScreen();

    expect(await screen.findByRole("button", { name: "XS" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "M" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "S" })).toBeEnabled();
  });

  it("объясняет зачёркнутые размеры словами", async () => {
    renderScreen();

    expect(await screen.findByText("Зачёркнутых размеров сейчас нет в наличии.")).toBeTruthy();
  });

  it("у товара, где всё в наличии, объяснения нет", async () => {
    product.mockResolvedValue(
      card({ sizeRows: [{ size: "S", available: true }, { size: "M", available: true }] }),
    );
    renderScreen();

    await screen.findByRole("heading", { name: /Сахарок/ });
    expect(screen.queryByText(/Зачёркнутых размеров/)).toBeNull();
  });

  it("открывает таблицу размеров с мерками", async () => {
    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: /Таблица размеров/ }));

    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("34–40")).toBeTruthy();
    expect(within(sheet).getByText("18–22")).toBeTruthy();
    // Недоступный размер из таблицы не выкидывается: мерки от наличия не зависят.
    expect(within(sheet).getByText("40–46")).toBeTruthy();
  });

  it("без мерок предлагает написать в магазин, а не пустую таблицу", async () => {
    product.mockResolvedValue(card({ sizeRows: [{ size: "S", available: true }] }));
    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: /Таблица размеров/ }));

    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText(/подберём размер по фото/)).toBeTruthy();
    expect(within(sheet).queryByRole("table")).toBeNull();
  });
});

describe("ProductScreen — расцветки", () => {
  it("выбирает первую расцветку и называет её словом", async () => {
    product.mockResolvedValue(
      card({
        colors: [
          { name: "Сливочный", hex: "#FBF3E4" },
          { name: "Карамель", hex: "#C98B4B" },
        ],
      }),
    );
    renderScreen();

    expect(await screen.findByText("Сливочный")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Карамель" }));

    expect(await screen.findByText("Карамель")).toBeTruthy();
  });

  it("без расцветок блока нет", async () => {
    renderScreen();

    await screen.findByRole("heading", { name: /Сахарок/ });
    expect(screen.queryByText("расцветка")).toBeNull();
  });
});

describe("ProductScreen — похожие", () => {
  it("берёт популярное из той же категории и выбрасывает сам товар", async () => {
    products.mockResolvedValue(
      similar([tile(1, { slug: "sviter-saharok" }), tile(2), tile(3)]),
    );
    renderScreen();

    expect(await screen.findByText("Сосед 2")).toBeTruthy();
    expect(screen.getByText("Сосед 3")).toBeTruthy();
    // Текущий товар среди похожих — это ссылка на самого себя.
    expect(screen.queryByText("Сосед 1")).toBeNull();
    expect(products.mock.calls[0]?.[0]).toMatchObject({ category: "sweaters", sort: "pop" });
  });

  it("показывает не больше четырёх", async () => {
    products.mockResolvedValue(similar([1, 2, 3, 4, 5, 6].map((index) => tile(index))));
    renderScreen();

    await screen.findByText("Сосед 1");
    expect(screen.queryByText("Сосед 5")).toBeNull();
  });

  it("клик по похожему ведёт на его карточку", async () => {
    products.mockResolvedValue(similar([tile(2)]));
    renderScreen();

    fireEvent.click(await screen.findByText("Сосед 2"));

    expect(window.location.hash).toBe("#/product/sosed-2");
  });

  it("без похожих блока нет", async () => {
    renderScreen();

    await screen.findByRole("heading", { name: /Сахарок/ });
    expect(screen.queryByText("Похожие")).toBeNull();
  });
});

describe("ProductScreen — товара нет", () => {
  it("на 404 объясняет отсутствие товара и уводит в каталог", async () => {
    product.mockRejectedValue(new HttpError(404, "/catalog/products/net: HTTP 404"));
    renderScreen("net");

    expect(await screen.findByText("Такого товара нет")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "В каталог" }));
    expect(window.location.hash).toBe("#/");
  });

  // 404 — окончательный ответ: повтор показал бы «загружаем» вместо объяснения.
  it("не повторяет запрос за товаром, которого нет", async () => {
    product.mockRejectedValue(new HttpError(404, "HTTP 404"));
    renderScreen("net");

    await screen.findByText("Такого товара нет");
    expect(product).toHaveBeenCalledTimes(1);
  });

  it("обрыв связи отличает от отсутствия товара", async () => {
    product.mockRejectedValue(new Error("network"));
    renderScreen();

    // Ожидание длиннее секунды по умолчанию намеренно: в отличие от 404, обрыв
    // связи экран один раз повторяет, и повтор идёт с паузой в секунду.
    expect(await screen.findByText("Карточка не загрузилась", {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.queryByText("Такого товара нет")).toBeNull();
    expect(product).toHaveBeenCalledTimes(2);
  });
});

describe("ProductScreen — назад", () => {
  // Прямая ссылка на товар — то, ради чего роутер и сделан на хэше: в истории
  // вкладки перед ней нашего каталога нет, и `history.back()` увёл бы наружу.
  it("с прямой ссылки уводит в каталог, а не из приложения", async () => {
    const back = vi.spyOn(window.history, "back");
    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: "Назад" }));

    expect(back).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("#/");
    back.mockRestore();
  });

  it("после перехода внутри приложения возвращает историю назад", async () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    products.mockResolvedValue(similar([tile(2)]));
    renderScreen();

    // Переход на похожий товар — та самая запись в истории, куда ведёт «назад».
    fireEvent.click(await screen.findByText("Сосед 2"));
    fireEvent.click(screen.getByRole("button", { name: "Назад" }));

    expect(back).toHaveBeenCalled();
    back.mockRestore();
  });
});
