// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CartPreview, Order, OrderDraft } from "@mikki-shop/shared-types";

vi.mock("../api/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/catalog")>()),
  fetchCartPreview: vi.fn(),
  createOrder: vi.fn(),
  fetchPets: vi.fn(),
}));

import { HttpError, createOrder, fetchCartPreview, fetchPets } from "../api/catalog";
import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart";
import { CheckoutScreen } from "./CheckoutScreen";

const preview = vi.mocked(fetchCartPreview);
const place = vi.mocked(createOrder);
const pets = vi.mocked(fetchPets);

const ITEM = { slug: "bandana-kletka", size: "M", color: "Кирпичный", quantity: 2 } as const;

const PREVIEW: CartPreview = {
  lines: [
    {
      slug: "bandana-kletka",
      title: "Бандана «Клетка»",
      size: "M",
      color: "Кирпичный",
      price: 590,
      quantity: 2,
      maxQuantity: 6,
      lineTotal: 1180,
    },
  ],
  gone: [],
  total: 1180,
  count: 2,
  hasShortage: false,
};

const ORDER: Order = {
  number: 42,
  status: "NEW",
  createdAt: "2026-09-03T12:00:00.000Z",
  customerName: "Денис",
  phone: "+79161234567",
  delivery: "pickup",
  total: 1180,
  lines: [
    { slug: "bandana-kletka", title: "Бандана «Клетка»", size: "M", price: 590, quantity: 2 },
  ],
};

function signIn() {
  useAuth.setState({
    token: "signed.jwt.token",
    expiresAt: Date.now() + 60 * 60 * 1000,
    user: { id: "u1", telegramId: "1", firstName: "Денис", lastName: "Шульга", isPremium: false },
  });
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CheckoutScreen />
    </QueryClientProvider>,
  );
}

/** Заполнить форму до состояния, в котором заявку можно отправить. */
async function fillForm({ consent = true }: { consent?: boolean } = {}) {
  fireEvent.change(screen.getByPlaceholderText("+7 900 000-00-00"), {
    target: { value: "+7 916 123-45-67" },
  });
  fireEvent.click(screen.getByText("Самовывоз"));
  if (consent) fireEvent.click(screen.getByRole("checkbox"));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Отправить заявку" })).toBeTruthy(),
  );
}

beforeEach(() => {
  window.location.hash = "";
  window.localStorage.clear();
  useCart.setState({ items: [ITEM] });
  useAuth.setState({ token: null, expiresAt: null, user: null });
  preview.mockResolvedValue(PREVIEW);
  place.mockResolvedValue(ORDER);
  pets.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CheckoutScreen — пустая корзина", () => {
  it("не предлагает оформлять пустоту", async () => {
    useCart.setState({ items: [] });
    signIn();
    renderScreen();

    expect(await screen.findByText("Оформлять нечего")).toBeTruthy();
    expect(place).not.toHaveBeenCalled();
  });
});

describe("CheckoutScreen — гость", () => {
  // Заказ привязывается к покупателю, а «кто это» знает только Telegram.
  // Сказать об этом надо до того, как человек заполнит всю форму.
  it("объясняет, что заказ оформляется из Telegram, и не даёт отправить", async () => {
    renderScreen();

    expect(await screen.findByText("Заказ оформляется из Telegram")).toBeTruthy();
    await fillForm();
    expect(screen.getByRole("button", { name: "Отправить заявку" })).toBeDisabled();
  });
});

describe("CheckoutScreen — форма", () => {
  beforeEach(signIn);

  it("подставляет имя из Telegram", async () => {
    renderScreen();

    await waitFor(() => expect(screen.getByDisplayValue("Денис Шульга")).toBeTruthy());
  });

  it("без телефона отправить нельзя", async () => {
    renderScreen();
    await screen.findByText("как получить");

    expect(screen.getByRole("button", { name: "Отправить заявку" })).toBeDisabled();
  });

  // Имя, телефон и адрес — персональные данные (152-ФЗ).
  it("без согласия на обработку данных отправить нельзя, и это сказано", async () => {
    renderScreen();
    await screen.findByText("как получить");
    await fillForm({ consent: false });

    expect(screen.getByRole("button", { name: "Отправить заявку" })).toBeDisabled();
    expect(screen.getByText(/Без согласия на обработку данных/)).toBeTruthy();
  });

  it("курьеру нужен адрес, самовывозу — нет", async () => {
    renderScreen();
    await screen.findByText("как получить");

    // Курьер выбран по умолчанию: поле адреса на месте, и без него нельзя.
    fireEvent.change(screen.getByPlaceholderText("+7 900 000-00-00"), {
      target: { value: "+79161234567" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByPlaceholderText(/Город, улица/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Отправить заявку" })).toBeDisabled();

    fireEvent.click(screen.getByText("Самовывоз"));
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(/Город, улица/)).toBeNull(),
    );
    expect(screen.getByRole("button", { name: "Отправить заявку" })).toBeEnabled();
  });

  // Остатки могли измениться, пока заполняли форму. Сервер откажет всему
  // заказу — отправлять такую заявку значит гонять покупателя за 409.
  it("не даёт отправить, если в корзине уже нехватка", async () => {
    preview.mockResolvedValue({ ...PREVIEW, hasShortage: true });
    renderScreen();
    await screen.findByText("как получить");
    await fillForm();

    expect(screen.getByRole("button", { name: "Отправить заявку" })).toBeDisabled();
  });

  it("отправляет заявку с тем, что ввели, и позициями корзины", async () => {
    renderScreen();
    await screen.findByText("как получить");
    await fillForm();
    fireEvent.change(screen.getByPlaceholderText("Микки"), { target: { value: "Микки" } });

    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));

    await waitFor(() => expect(place).toHaveBeenCalled());
    const draft = place.mock.calls[0]?.[0] as OrderDraft;
    expect(draft).toMatchObject({
      customerName: "Денис Шульга",
      phone: "+7 916 123-45-67",
      delivery: "pickup",
      petName: "Микки",
      // Согласие едет на сервер: там оно записывается к заказу отметкой
      // времени, и доказывать его придётся по конкретному заказу (152-ФЗ).
      consent: true,
      items: [{ slug: "bandana-kletka", size: "M", color: "Кирпичный", quantity: 2 }],
    });
    expect(draft).not.toHaveProperty("address");
  });
});

describe("CheckoutScreen — питомец из профиля", () => {
  beforeEach(signIn);

  it("подставляет кличку по нажатию, вместо набора руками", async () => {
    pets.mockResolvedValue([
      { id: "pet1", name: "Микки", size: "S" },
      { id: "pet2", name: "Соня" },
    ]);
    renderScreen();
    await screen.findByText("как получить");

    fireEvent.click(await screen.findByRole("button", { name: /Микки/ }));

    expect(screen.getByPlaceholderText("Микки")).toHaveValue("Микки");
  });

  // Кличка необязательна: передумать после первого касания должно быть чем.
  it("повторное нажатие снимает выбор", async () => {
    pets.mockResolvedValue([{ id: "pet1", name: "Микки" }]);
    renderScreen();
    await screen.findByText("как получить");

    const chip = await screen.findByRole("button", { name: /Микки/ });
    fireEvent.click(chip);
    fireEvent.click(chip);

    expect(screen.getByPlaceholderText("Микки")).toHaveValue("");
  });

  it("уносит выбранную кличку в заявку", async () => {
    pets.mockResolvedValue([{ id: "pet1", name: "Соня" }]);
    renderScreen();
    await screen.findByText("как получить");
    await fillForm();

    fireEvent.click(await screen.findByRole("button", { name: /Соня/ }));
    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));

    await waitFor(() => expect(place).toHaveBeenCalled());
    const draft = place.mock.calls[0]?.[0] as OrderDraft | undefined;
    expect(draft?.petName).toBe("Соня");
  });

  // Поле остаётся текстовым: заказать можно и на питомца без карточки.
  it("оставляет возможность набрать кличку руками", async () => {
    pets.mockResolvedValue([{ id: "pet1", name: "Микки" }]);
    renderScreen();
    await screen.findByText("как получить");

    fireEvent.change(screen.getByPlaceholderText("Микки"), { target: { value: "Барон" } });

    expect(screen.getByPlaceholderText("Микки")).toHaveValue("Барон");
  });

  /**
   * Справочник питомцев заказу не обязателен: если он не загрузился, форма
   * должна остаться рабочей, а не встать вместе с ним.
   */
  it("переживает недоступный справочник питомцев", async () => {
    pets.mockRejectedValue(new Error("нет сети"));
    renderScreen();
    await screen.findByText("как получить");
    await fillForm();

    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));

    expect(await screen.findByText("Заказ 42 принят")).toBeTruthy();
  });

  it("гостю за питомцами не ходит", async () => {
    useAuth.setState({ token: null, expiresAt: null, user: null });
    renderScreen();

    await screen.findByText("Заказ оформляется из Telegram");
    expect(pets).not.toHaveBeenCalled();
  });
});

describe("CheckoutScreen — заявка отправлена", () => {
  beforeEach(signIn);

  it("показывает номер заказа и чистит корзину", async () => {
    renderScreen();
    await screen.findByText("как получить");
    await fillForm();

    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));

    expect(await screen.findByText("Заказ 42 принят")).toBeTruthy();
    expect(useCart.getState().items).toEqual([]);
  });

  // Упади запрос — покупатель остался бы и без заказа, и без корзины.
  it("не чистит корзину, если заявка не ушла", async () => {
    place.mockRejectedValue(new Error("network"));
    renderScreen();
    await screen.findByText("как получить");
    await fillForm();

    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));

    expect(await screen.findByText("Заказ не отправился")).toBeTruthy();
    expect(useCart.getState().items).toHaveLength(1);
  });

  // 409 — это не «попробуйте снова»: состав надо править, а не повторять.
  it("на разобранный товар ведёт в корзину, а не предлагает повтор", async () => {
    place.mockRejectedValue(new HttpError(409, "out of stock"));
    renderScreen();
    await screen.findByText("как получить");
    await fillForm();

    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));

    expect(await screen.findByText("Часть товаров разобрали")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Вернуться в корзину" }));
    expect(window.location.hash).toBe("#/cart");
  });

  it("на 400 просит проверить поля, а не соединение", async () => {
    place.mockRejectedValue(new HttpError(400, "invalid"));
    renderScreen();
    await screen.findByText("как получить");
    await fillForm();

    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));

    expect(await screen.findByText(/Проверьте телефон и адрес/)).toBeTruthy();
  });
});
