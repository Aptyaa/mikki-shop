// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { introCollapsed, rememberIntroCollapsed } from "./onboarding";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("onboarding", () => {
  // Первый вход обязан увидеть объяснение: пустое хранилище — это «раскрыт».
  it("по умолчанию блок раскрыт", () => {
    expect(introCollapsed()).toBe(false);
  });

  it("помнит сворачивание и разворачивание", () => {
    rememberIntroCollapsed(true);
    expect(introCollapsed()).toBe(true);

    rememberIntroCollapsed(false);
    expect(introCollapsed()).toBe(false);
  });

  // Приватный режим Safari бросает на любом обращении к хранилищу.
  it("переживает недоступное хранилище", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(() => rememberIntroCollapsed(true)).not.toThrow();
    expect(introCollapsed()).toBe(false);
  });
});
