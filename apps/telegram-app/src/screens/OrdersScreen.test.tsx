// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Order } from "@mikki-shop/shared-types";

vi.mock("../api/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/catalog")>()),
  fetchOrders: vi.fn(),
}));

import { fetchOrders } from "../api/catalog";
import { useAuth } from "../lib/auth";
import { OrdersScreen } from "./OrdersScreen";

const orders = vi.mocked(fetchOrders);

function order(over: Partial<Order> = {}): Order {
  return {
    number: 42,
    status: "NEW",
    createdAt: "2026-09-03T12:00:00.000Z",
    customerName: "Денис",
    phone: "+79161234567",
    delivery: "courier",
    address: "Москва",
    total: 1180,
    lines: [
      {
        slug: "bandana-kletka",
        title: "Бандана «Клетка»",
        size: "M",
        color: "Кирпичный",
        price: 590,
        quantity: 2,
      },
    ],
    ...over,
  };
}

function signIn() {
  useAuth.setState({
    token: "signed.jwt.token",
    expiresAt: Date.now() + 60 * 60 * 1000,
    user: { id: "u1", telegramId: "1", isPremium: false },
  });
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OrdersScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.location.hash = "";
  window.localStorage.clear();
  useAuth.setState({ token: null, expiresAt: null, user: null });
  orders.mockResolvedValue([order()]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("OrdersScreen — гость", () => {
  it("не ходит за заказами и объясняет, почему их нет", async () => {
    renderScreen();

    expect(await screen.findByText("Заказы видны из Telegram")).toBeTruthy();
    expect(orders).not.toHaveBeenCalled();
  });
});

describe("OrdersScreen — список", () => {
  beforeEach(signIn);

  it("рисует заказ с номером, статусом, составом и итогом", async () => {
    renderScreen();

    expect(await screen.findByText("Заказ 42")).toBeTruthy();
    expect(screen.getByText("новый")).toBeTruthy();
    expect(screen.getByText(/Бандана «Клетка» — M, Кирпичный × 2/)).toBeTruthy();
    expect(screen.getByText("Итого")).toBeTruthy();
  });

  // Цена в каталоге уже могла поменяться, а заплатят по той, что была.
  it("показывает цену из заказа, а не текущую", async () => {
    orders.mockResolvedValue([order({ total: 1180 })]);
    renderScreen();

    await screen.findByText("Заказ 42");
    // Строка (590 × 2) и итог — обе по 1 180 ₽.
    expect(screen.getAllByText(/1\s180\s₽/)).toHaveLength(2);
  });

  it("знает все статусы заказа", async () => {
    orders.mockResolvedValue([
      order({ number: 1, status: "CONFIRMED" }),
      order({ number: 2, status: "SHIPPED" }),
      order({ number: 3, status: "DONE" }),
      order({ number: 4, status: "CANCELLED" }),
    ]);
    renderScreen();

    expect(await screen.findByText("подтверждён")).toBeTruthy();
    expect(screen.getByText("отправлен")).toBeTruthy();
    expect(screen.getByText("получен")).toBeTruthy();
    expect(screen.getByText("отменён")).toBeTruthy();
  });

  it("на пустом списке зовёт в каталог", async () => {
    orders.mockResolvedValue([]);
    renderScreen();

    expect(await screen.findByText("Заказов пока нет")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "В каталог" }));
    expect(window.location.hash).toBe("#/");
  });

  it("на сбой предлагает повторить", async () => {
    orders.mockRejectedValue(new Error("network"));
    renderScreen();

    expect(await screen.findByText("Заказы не загрузились")).toBeTruthy();

    orders.mockResolvedValue([order()]);
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(await screen.findByText("Заказ 42")).toBeTruthy();
  });
});
