// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import type { AuthSession } from "@mikki-shop/shared-types";

vi.mock("../api/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/catalog")>()),
  login: vi.fn(),
}));

import { login } from "../api/catalog";
import { useAuth } from "./auth";
import { useSession } from "./session";

const signIn = vi.mocked(login);

const SESSION: AuthSession = {
  token: "signed.jwt.token",
  expiresAt: Date.now() + 60 * 60 * 1000,
  user: { id: "u1", telegramId: "5140053721", firstName: "Денис", isPremium: false },
};

function Probe() {
  useSession();
  return null;
}

function userInitData(id: number): string {
  return `user=${encodeURIComponent(JSON.stringify({ id }))}&hash=abc`;
}

function enterTelegram(initData = userInitData(5140053721)) {
  window.Telegram = {
    WebApp: { initData, platform: "ios", ready: vi.fn(), expand: vi.fn() } as never,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  useAuth.setState({ token: null, expiresAt: null, user: null });
  signIn.mockResolvedValue(SESSION);
});

afterEach(() => {
  cleanup();
  delete window.Telegram;
  vi.clearAllMocks();
});

describe("useSession", () => {
  it("меняет initData на токен при старте внутри Telegram", async () => {
    enterTelegram();
    render(<Probe />);

    await waitFor(() => expect(useAuth.getState().token).toBe("signed.jwt.token"));
    expect(signIn.mock.calls[0]?.[0]).toBe(userInitData(5140053721));
  });

  // Каталог, карточка и корзина публичные: вне Telegram приложение обязано
  // работать гостем, а не биться в закрытую дверь.
  it("вне Telegram не ходит за токеном", async () => {
    render(<Probe />);

    await Promise.resolve();
    expect(signIn).not.toHaveBeenCalled();
    expect(useAuth.getState().token).toBeNull();
  });

  it("не ходит за токеном, если живой уже есть", async () => {
    enterTelegram();
    useAuth.getState().signIn(SESSION);
    render(<Probe />);

    await Promise.resolve();
    expect(signIn).not.toHaveBeenCalled();
  });

  // Истёкший токен обменивается на новый молча: `initData` под рукой.
  it("обновляет истёкший токен", async () => {
    enterTelegram();
    useAuth.getState().signIn({ ...SESSION, token: "старый", expiresAt: Date.now() - 1000 });
    render(<Probe />);

    await waitFor(() => expect(useAuth.getState().token).toBe("signed.jwt.token"));
  });

  it("не ходит за токеном с пустым initData", async () => {
    enterTelegram("");
    render(<Probe />);

    await Promise.resolve();
    expect(signIn).not.toHaveBeenCalled();
  });

  // Сорвавшийся вход не должен ломать витрину: сказать о нём будет что на
  // экране оформления заказа, там это и мешает.
  it("на сбой входа оставляет приложение гостевым и не падает", async () => {
    enterTelegram();
    signIn.mockRejectedValue(new Error("network"));

    expect(() => render(<Probe />)).not.toThrow();
    await waitFor(() => expect(signIn).toHaveBeenCalled());
    expect(useAuth.getState().token).toBeNull();
  });
});

describe("useSession — смена аккаунта", () => {
  // Хранилище Mini App общее для всех аккаунтов одного клиента, а токен живёт
  // месяц: без сверки аккаунт B работал бы под сессией аккаунта A.
  it("сбрасывает чужую сессию и входит заново", async () => {
    enterTelegram(userInitData(999));
    useAuth.getState().signIn(SESSION);
    // Бэкенд отвечает про того, чей `initData` прислали.
    signIn.mockResolvedValue({
      ...SESSION,
      token: "второй.jwt.token",
      user: { id: "u2", telegramId: "999", isPremium: false },
    });
    render(<Probe />);

    await waitFor(() => expect(signIn).toHaveBeenCalled());
    expect(signIn.mock.calls[0]?.[0]).toBe(userInitData(999));
    await waitFor(() => expect(useAuth.getState().user?.telegramId).toBe("999"));
  });

  // Сервер, вернувший не тот аккаунт, не должен загонять вход в круг
  // «сбросили — вошли — опять не тот — сбросили».
  it("не зацикливается, если сервер вернул другой аккаунт", async () => {
    enterTelegram(userInitData(999));
    useAuth.getState().signIn(SESSION);
    render(<Probe />);

    await waitFor(() => expect(signIn).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it("свою сессию не трогает", async () => {
    enterTelegram(userInitData(5140053721));
    useAuth.getState().signIn(SESSION);
    render(<Probe />);

    await Promise.resolve();
    expect(signIn).not.toHaveBeenCalled();
    expect(useAuth.getState().token).toBe("signed.jwt.token");
  });
});

describe("useSession — сервер отверг токен", () => {
  // Клиент меряет годность своим `expiresAt`, а сервер может отказать раньше:
  // сменился секрет, пропала строка покупателя. Сброс сессии обязан приводить
  // к новому входу сам, без перезагрузки Mini App.
  it("после сброса сессии входит заново", async () => {
    enterTelegram();
    useAuth.getState().signIn(SESSION);
    render(<Probe />);
    await Promise.resolve();
    expect(signIn).not.toHaveBeenCalled();

    // Так же, как это делает api-клиент на 401.
    useAuth.getState().signOut();

    await waitFor(() => expect(signIn).toHaveBeenCalled());
    await waitFor(() => expect(useAuth.getState().token).toBe("signed.jwt.token"));
  });

  it("не зацикливается, если вход не удаётся", async () => {
    enterTelegram();
    signIn.mockRejectedValue(new Error("network"));
    render(<Probe />);

    await waitFor(() => expect(signIn).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(signIn).toHaveBeenCalledTimes(1);
  });
});
