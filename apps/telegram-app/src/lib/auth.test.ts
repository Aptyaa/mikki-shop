// @vitest-environment jsdom
// DOM нужен ради `localStorage`: токен персистится, иначе каждый холодный
// старт Mini App ходил бы за новым.
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthSession } from "@mikki-shop/shared-types";
import { bearerToken, useAuth } from "./auth";

const HOUR = 60 * 60 * 1000;

function session(over: Partial<AuthSession> = {}): AuthSession {
  return {
    token: "signed.jwt.token",
    expiresAt: Date.now() + HOUR,
    user: { id: "u1", telegramId: "5140053721", firstName: "Денис", isPremium: false },
    ...over,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  useAuth.setState({ token: null, expiresAt: null, user: null });
});

describe("useAuth", () => {
  it("гость по умолчанию — это нормальное состояние, а не ошибка", () => {
    expect(useAuth.getState()).toMatchObject({ token: null, user: null });
    expect(bearerToken()).toBeNull();
  });

  it("запоминает сессию после входа", () => {
    useAuth.getState().signIn(session());

    expect(useAuth.getState().user).toMatchObject({ telegramId: "5140053721" });
    expect(bearerToken()).toBe("signed.jwt.token");
  });

  it("переживает перезагрузку", () => {
    useAuth.getState().signIn(session());

    const stored = window.localStorage.getItem("mikki-auth");
    expect(JSON.parse(stored ?? "{}")).toMatchObject({
      state: { token: "signed.jwt.token" },
      version: 1,
    });
  });

  it("выход стирает и токен, и профиль", () => {
    useAuth.getState().signIn(session());
    useAuth.getState().signOut();

    expect(useAuth.getState()).toMatchObject({ token: null, expiresAt: null, user: null });
    expect(bearerToken()).toBeNull();
  });
});

describe("bearerToken — срок", () => {
  it("не отдаёт истёкший токен", () => {
    useAuth.getState().signIn(session({ expiresAt: Date.now() - 1000 }));

    expect(bearerToken()).toBeNull();
  });

  // Токен, истекающий через полминуты, до сервера доедет уже мёртвым: сходить
  // за новым заранее дешевле, чем получить 401 на оформлении заказа.
  it("не отдаёт токен, который вот-вот истечёт", () => {
    useAuth.getState().signIn(session({ expiresAt: Date.now() + 30_000 }));

    expect(bearerToken()).toBeNull();
  });

  it("отдаёт токен с запасом времени", () => {
    useAuth.getState().signIn(session({ expiresAt: Date.now() + HOUR }));

    expect(bearerToken()).toBe("signed.jwt.token");
  });
});
