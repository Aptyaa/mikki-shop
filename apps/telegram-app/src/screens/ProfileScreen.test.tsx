// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Pet } from "@mikki-shop/shared-types";

// Подменяется только сеть; `HttpError` берётся настоящий — по нему экран
// отличает занятую кличку от прочих отказов.
vi.mock("../api/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/catalog")>()),
  fetchPets: vi.fn(),
  createPet: vi.fn(),
  updatePet: vi.fn(),
  deletePet: vi.fn(),
}));

import { HttpError, createPet, deletePet, fetchPets, updatePet } from "../api/catalog";
import { useAuth } from "../lib/auth";
import { ProfileScreen } from "./ProfileScreen";

const pets = vi.mocked(fetchPets);
const create = vi.mocked(createPet);
const update = vi.mocked(updatePet);
const remove = vi.mocked(deletePet);

const MIKKI: Pet = {
  id: "pet1",
  name: "Микки",
  breed: "Мальтипу",
  size: "S",
  chestCm: 38,
  neckCm: 24,
  backCm: 30,
};

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProfileScreen />
    </QueryClientProvider>,
  );
}

function signIn(over: Partial<{ firstName: string; lastName: string; username: string; photoUrl: string }> = {}) {
  useAuth.setState({
    token: "signed.jwt.token",
    expiresAt: Date.now() + 60 * 60 * 1000,
    user: { id: "u1", telegramId: "1", isPremium: false, ...over },
  });
}

/**
 * Подпись задаётся регуляркой: у поля породы к ней приклеена подсказка, и
 * доступное имя у него — «Порода Необязательно…», а не одно слово.
 */
function type(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

/** Черновик, с которым экран последний раз ходил на сервер. */
function lastDraft(): Record<string, unknown> {
  const created = create.mock.calls.at(-1)?.[0];
  return (created ?? update.mock.calls.at(-1)?.[1]) as unknown as Record<string, unknown>;
}

beforeEach(() => {
  window.location.hash = "";
  window.localStorage.clear();
  useAuth.setState({ token: null, expiresAt: null, user: null });
  pets.mockResolvedValue([MIKKI]);
  create.mockResolvedValue(MIKKI);
  update.mockResolvedValue(MIKKI);
  remove.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProfileScreen — гость", () => {
  it("не ходит за питомцами и объясняет, почему профиля нет", async () => {
    renderScreen();

    expect(await screen.findByText("Профиль виден из Telegram")).toBeTruthy();
    expect(pets).not.toHaveBeenCalled();
  });
});

describe("ProfileScreen — кто вошёл", () => {
  it("показывает имя и фамилию из Telegram", async () => {
    signIn({ firstName: "Денис", lastName: "Ш." });
    renderScreen();

    expect(await screen.findByText("Денис Ш.")).toBeTruthy();
  });

  // Имени в Telegram может не быть — тогда остаётся @username.
  it("без имени показывает username", async () => {
    signIn({ username: "denis" });
    renderScreen();

    expect(await screen.findByText("@denis")).toBeTruthy();
  });

  it("ведёт в заказы", async () => {
    signIn({ firstName: "Денис" });
    renderScreen();

    fireEvent.click(await screen.findByText("Мои заказы"));
    expect(window.location.hash).toBe("#/orders");
  });
});

describe("ProfileScreen — список питомцев", () => {
  it("показывает кличку, породу, размер и мерки", async () => {
    signIn();
    renderScreen();

    expect(await screen.findByText("Микки")).toBeTruthy();
    expect(screen.getByText("Мальтипу")).toBeTruthy();
    expect(screen.getByText("S")).toBeTruthy();
    expect(screen.getByText("грудь 38 · шея 24 · спина 30 см")).toBeTruthy();
  });

  // Незаполненные мерки — это «не сняли», и так и должно быть написано:
  // прочерк или ноль читались бы как настоящее значение.
  it("про неснятые мерки говорит прямо", async () => {
    signIn();
    pets.mockResolvedValue([{ id: "pet2", name: "Соня" }]);
    renderScreen();

    expect(await screen.findByText("Мерки не сняты")).toBeTruthy();
  });

  it("на пустом списке зовёт завести карточку", async () => {
    signIn();
    pets.mockResolvedValue([]);
    renderScreen();

    expect(await screen.findByText("Питомца ещё нет")).toBeTruthy();
  });

  it("на сбое предлагает повторить и повторяет", async () => {
    signIn();
    pets.mockRejectedValueOnce(new Error("нет сети"));
    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: "Повторить" }));
    expect(await screen.findByText("Микки")).toBeTruthy();
  });
});

describe("ProfileScreen — новая карточка", () => {
  it("не даёт сохранить без клички", async () => {
    signIn();
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: "добавить" }));

    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
  });

  it("отправляет заполненные поля и закрывает лист", async () => {
    signIn();
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: "добавить" }));

    type("Кличка", "  Соня  ");
    type(/Порода/, "Шпиц");
    fireEvent.click(screen.getByRole("button", { name: "M" }));
    type("Грудь", "40");

    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(lastDraft()).toEqual({ name: "Соня", breed: "Шпиц", size: "M", chestCm: 40 });
    await waitFor(() => expect(screen.queryByText("Новый питомец")).toBeNull());
  });

  // Пустая мерка — это «не мерил», а не ноль сантиметров.
  it("пустые поля не отправляет вовсе", async () => {
    signIn();
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: "добавить" }));

    type("Кличка", "Соня");
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(lastDraft()).toEqual({ name: "Соня" });
  });

  it("занятую кличку показывает у поля клички, а не общей плашкой", async () => {
    signIn();
    create.mockRejectedValue(
      new HttpError(409, "conflict", "duplicate-name", "Питомец с такой кличкой уже есть"),
    );
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: "добавить" }));

    type("Кличка", "Микки");
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByText("Питомец с такой кличкой уже есть")).toBeTruthy();
    expect(screen.queryByText("Не сохранилось")).toBeNull();
    // Лист остаётся открытым: кличку ещё надо поправить.
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeTruthy();
  });

  // Сервер знает, какая именно мерка не подошла, — его текст и показываем.
  it("на отказ по мерке показывает текст сервера", async () => {
    signIn();
    create.mockRejectedValue(
      new HttpError(400, "bad request", "invalid", "Длина спины: от 1 до 200 см"),
    );
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: "добавить" }));

    type("Кличка", "Соня");
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByText("Длина спины: от 1 до 200 см")).toBeTruthy();
  });
});

describe("ProfileScreen — правка и удаление", () => {
  it("открывает карточку заполненной и сохраняет правку", async () => {
    signIn();
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: /Изменить карточку/ }));

    expect(screen.getByLabelText("Кличка")).toHaveValue("Микки");
    expect(screen.getByLabelText("Грудь")).toHaveValue("38");

    type("Кличка", "Мика");
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0]?.[0]).toBe("pet1");
    expect(lastDraft()).toMatchObject({ name: "Мика" });
  });

  // Стёртое в форме поле должно стереться и в базе: иначе однажды заполненную
  // породу нечем было бы убрать.
  it("стёртое поле уезжает как отсутствующее, а не как старое значение", async () => {
    signIn();
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: /Изменить карточку/ }));

    type(/Порода/, "");
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(lastDraft()).not.toHaveProperty("breed");
  });

  it("удаляет только после подтверждения и обещает сохранить историю", async () => {
    signIn();
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: /Изменить карточку/ }));

    fireEvent.click(screen.getByRole("button", { name: /Удалить питомца/ }));
    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByText(/Прошлые заказы это не тронет/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("pet1"));
  });

  it("передумать и оставить питомца можно", async () => {
    signIn();
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: /Изменить карточку/ }));

    fireEvent.click(screen.getByRole("button", { name: /Удалить питомца/ }));
    fireEvent.click(screen.getByRole("button", { name: "Оставить" }));

    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Удалить питомца/ })).toBeTruthy();
  });

  // Иначе отказ по прошлой карточке висел бы над следующей.
  it("не тащит ошибку прошлой правки в новую карточку", async () => {
    signIn();
    create.mockRejectedValue(new HttpError(409, "conflict", "duplicate-name", "Кличка занята"));
    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: "добавить" }));
    type("Кличка", "Микки");
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(await screen.findByText("Кличка занята")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    fireEvent.click(screen.getByRole("button", { name: "добавить" }));

    expect(screen.queryByText("Кличка занята")).toBeNull();
  });
});
