// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CartLineDto, CartPreview } from "@mikki-shop/shared-types";

// Подменяется только сеть: экран проверяется вместе с дизайн-системой и стором.
vi.mock("../api/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/catalog")>()),
  fetchCartPreview: vi.fn(),
}));

import { fetchCartPreview } from "../api/catalog";
import { cartKey, useCart } from "../lib/cart";
import { CartScreen } from "./CartScreen";

const preview = vi.mocked(fetchCartPreview);

const SAHAROK = { slug: "sviter-saharok", size: "S", color: "Сливочный", quantity: 1 } as const;

function line(over: Partial<CartLineDto> = {}): CartLineDto {
  return {
    slug: "sviter-saharok",
    title: "Вязаный свитер «Сахарок»",
    size: "S",
    color: "Сливочный",
    price: 1490,
    quantity: 1,
    maxQuantity: 3,
    lineTotal: 1490,
    ...over,
  };
}

function answer(over: Partial<CartPreview> = {}): CartPreview {
  const lines = over.lines ?? [line()];
  return {
    lines,
    gone: [],
    total: lines.reduce((sum, current) => sum + current.lineTotal, 0),
    count: lines.reduce((sum, current) => sum + Math.min(current.quantity, current.maxQuantity), 0),
    hasShortage: false,
    ...over,
  };
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CartScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.location.hash = "";
  window.localStorage.clear();
  useCart.setState({ items: [] });
  preview.mockResolvedValue(answer());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CartScreen — пустая корзина", () => {
  it("объясняет пустоту и уводит в каталог, не спрашивая бэкенд", async () => {
    renderScreen();

    expect(await screen.findByText("В корзине пока пусто")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "В каталог" }));
    expect(window.location.hash).toBe("#/catalog");
  });
});

describe("CartScreen — строки", () => {
  it("рисует позицию с размером, расцветкой и суммой", async () => {
    useCart.setState({ items: [SAHAROK] });
    renderScreen();

    expect(await screen.findByText("Вязаный свитер «Сахарок»")).toBeTruthy();
    expect(screen.getByText("Размер S · Сливочный")).toBeTruthy();
    // Дважды: сумма строки и итог по корзине из одной позиции.
    expect(screen.getAllByText("1 490 ₽")).toHaveLength(2);
  });

  // Цена в корзине приходит с бэкенда, а не из localStorage покупателя.
  it("шлёт бэкенду только слаг, размер, расцветку и количество", async () => {
    useCart.setState({ items: [SAHAROK] });
    renderScreen();

    await waitFor(() => expect(preview).toHaveBeenCalled());
    expect(preview.mock.calls[0]?.[0]).toEqual([
      { slug: "sviter-saharok", size: "S", color: "Сливочный", quantity: 1 },
    ]);
  });

  it("показывает итог и число товаров в шапке", async () => {
    useCart.setState({ items: [SAHAROK] });
    preview.mockResolvedValue(
      answer({ lines: [line({ quantity: 2, lineTotal: 2980 })] }),
    );
    renderScreen();

    expect(await screen.findAllByText("2 980 ₽")).toHaveLength(2);
    expect(screen.getByText("Итого")).toBeTruthy();
    expect(screen.getByText("2 товара")).toBeTruthy();
  });

  it("удаляет строку крестиком", async () => {
    useCart.setState({ items: [SAHAROK] });
    renderScreen();
    await screen.findByText("Вязаный свитер «Сахарок»");

    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));

    expect(useCart.getState().items).toEqual([]);
  });

  it("меняет количество степпером", async () => {
    useCart.setState({ items: [SAHAROK] });
    renderScreen();
    await screen.findByText("Вязаный свитер «Сахарок»");

    fireEvent.click(screen.getByRole("button", { name: "Больше" }));

    expect(useCart.getState().items[0]?.quantity).toBe(2);
  });

  it("очищает корзину целиком", async () => {
    useCart.setState({ items: [SAHAROK] });
    renderScreen();
    await screen.findByText("Вязаный свитер «Сахарок»");

    fireEvent.click(screen.getByRole("button", { name: "Очистить корзину" }));

    expect(useCart.getState().items).toEqual([]);
  });
});

describe("CartScreen — наличие", () => {
  it("не даёт набрать больше, чем есть на складе", async () => {
    useCart.setState({ items: [{ ...SAHAROK, quantity: 2 }] });
    preview.mockResolvedValue(answer({ lines: [line({ quantity: 2, maxQuantity: 2 })] }));
    renderScreen();

    await screen.findByText("Вязаный свитер «Сахарок»");
    expect(screen.getByRole("button", { name: "Больше" })).toBeDisabled();
  });

  // Взяли две штуки, на складе осталась одна: количество приводится к складу,
  // а объяснение остаётся на экране — иначе оно исчезло бы вместе с нехваткой.
  it("подрезает количество по остатку и объясняет это", async () => {
    useCart.setState({ items: [{ ...SAHAROK, quantity: 3 }] });
    preview.mockResolvedValue(
      answer({ lines: [line({ quantity: 3, maxQuantity: 1 })], hasShortage: true }),
    );
    renderScreen();

    expect(await screen.findByText("Количество уменьшено")).toBeTruthy();
    await waitFor(() => expect(useCart.getState().items[0]?.quantity).toBe(1));
  });

  it("строку без остатка помечает и не даёт менять количество", async () => {
    useCart.setState({ items: [SAHAROK] });
    preview.mockResolvedValue(
      answer({ lines: [line({ maxQuantity: 0, lineTotal: 0 })], hasShortage: true }),
    );
    renderScreen();

    expect(await screen.findByText(/Этого размера сейчас нет/)).toBeTruthy();
    // Степпера нет вовсе: прибавлять нечего, строку можно только убрать.
    expect(screen.queryByRole("button", { name: "Больше" })).toBeNull();
    expect(screen.getByRole("button", { name: "Удалить" })).toBeTruthy();
  });

  // Иначе строка обещала бы «2 980 ₽» рядом с «Итого: 0 ₽».
  it("строка без остатка не показывает цену за недоступное", async () => {
    useCart.setState({ items: [{ ...SAHAROK, quantity: 2 }] });
    preview.mockResolvedValue(
      answer({ lines: [line({ quantity: 2, maxQuantity: 0, lineTotal: 0 })], hasShortage: true }),
    );
    renderScreen();

    await screen.findByText(/Этого размера сейчас нет/);
    expect(screen.queryByText("2 980 ₽")).toBeNull();
    // Дважды: сумма строки и итог, оба нулевые.
    expect(screen.getAllByText("0 ₽")).toHaveLength(2);
  });

  // Сервер отказывает всему заказу на любой строке, которой не хватает.
  // Пустить в чекаут значило бы прогнать покупателя по кругу «оформить → 409
  // → корзина» без единого способа его разомкнуть.
  it("не пускает оформлять, пока в корзине есть недоступная строка", async () => {
    useCart.setState({ items: [SAHAROK, { slug: "bandana-kletka", size: "M", quantity: 1 }] });
    preview.mockResolvedValue(
      answer({
        lines: [line(), line({ slug: "bandana-kletka", maxQuantity: 0, lineTotal: 0 })],
        hasShortage: true,
      }),
    );
    renderScreen();

    await screen.findByText(/Этого размера сейчас нет/);
    expect(screen.getByRole("button", { name: "Оформить заказ" })).toBeDisabled();
    expect(screen.getByText(/Уберите позиции, которых нет в наличии/)).toBeTruthy();
  });

  // Молча удалить строку хуже, чем показать её с пометкой: покупатель должен
  // увидеть, что именно выпало.
  it("не удаляет строку с нулевым остатком сама", async () => {
    useCart.setState({ items: [SAHAROK] });
    preview.mockResolvedValue(
      answer({ lines: [line({ maxQuantity: 0, lineTotal: 0 })], hasShortage: true }),
    );
    renderScreen();

    await screen.findByText(/Этого размера сейчас нет/);
    expect(useCart.getState().items).toHaveLength(1);
  });
});

describe("CartScreen — товар уехал из каталога", () => {
  it("выкидывает позиции, которых больше нет", async () => {
    useCart.setState({
      items: [SAHAROK, { slug: "net-takogo", size: "M", quantity: 1 }],
    });
    preview.mockResolvedValue(answer({ gone: ["net-takogo"] }));
    renderScreen();

    await waitFor(() =>
      expect(useCart.getState().items.map((item) => item.slug)).toEqual(["sviter-saharok"]),
    );
  });
});

describe("CartScreen — пересчёт не удался", () => {
  it("объясняет сбой и даёт повторить, не теряя корзину", async () => {
    useCart.setState({ items: [SAHAROK] });
    preview.mockRejectedValue(new Error("network"));
    renderScreen();

    expect(await screen.findByText("Корзина не пересчиталась")).toBeTruthy();
    expect(useCart.getState().items).toHaveLength(1);

    preview.mockResolvedValue(answer());
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));

    expect(await screen.findByText("Вязаный свитер «Сахарок»")).toBeTruthy();
  });
});

describe("CartScreen — ключ позиции", () => {
  it("строки одного товара в разных размерах удаляются по отдельности", async () => {
    const second = { ...SAHAROK, size: "M" } as const;
    useCart.setState({ items: [SAHAROK, second] });
    preview.mockResolvedValue(
      answer({ lines: [line(), line({ size: "M", title: "Вязаный свитер «Сахарок»" })] }),
    );
    renderScreen();

    await waitFor(() => expect(screen.getAllByRole("button", { name: "Удалить" })).toHaveLength(2));
    fireEvent.click(screen.getAllByRole("button", { name: "Удалить" })[0]!);

    expect(useCart.getState().items.map(cartKey)).toEqual([cartKey(second)]);
  });
});

describe("CartScreen — предупреждение о подрезке", () => {
  // Флагом это залипало бы: строку убрали, а объяснение про неё висит.
  it("исчезает вместе со строкой, к которой относилось", async () => {
    useCart.setState({ items: [{ ...SAHAROK, quantity: 3 }] });
    preview.mockResolvedValue(
      answer({ lines: [line({ quantity: 3, maxQuantity: 1 })], hasShortage: true }),
    );
    renderScreen();

    await screen.findByText("Количество уменьшено");

    preview.mockResolvedValue(answer({ lines: [] }));
    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));

    await waitFor(() => expect(screen.queryByText("Количество уменьшено")).toBeNull());
  });
});

describe("CartScreen — пересчёт на лету", () => {
  // Ключ запроса — состав корзины, то есть меняется на каждое нажатие «+».
  // Без `keepPreviousData` список и «Итого» подменялись бы скелетом.
  it("не роняет список в скелет, пока идёт пересчёт", async () => {
    useCart.setState({ items: [SAHAROK] });
    renderScreen();
    await screen.findByText("Вязаный свитер «Сахарок»");

    // Следующий пересчёт не завершается: экран обязан показывать прежние данные.
    preview.mockReturnValue(new Promise(() => {}));
    fireEvent.click(screen.getByRole("button", { name: "Больше" }));

    await waitFor(() => expect(preview).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Вязаный свитер «Сахарок»")).toBeTruthy();
    expect(screen.getByText("Итого")).toBeTruthy();
  });
});
