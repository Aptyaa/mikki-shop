// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  attachNativeBack,
  followTheme,
  inTelegram,
  initData,
  initDataUserId,
  start,
} from "./telegram";

type Handler = () => void;

function fakeWebApp(over: Record<string, unknown> = {}) {
  const events = new Map<string, Set<Handler>>();
  const backHandlers = new Set<Handler>();

  return {
    initData: "user=%7B%22id%22%3A1%7D&hash=abc",
    platform: "ios",
    colorScheme: "light" as "light" | "dark",
    ready: vi.fn(),
    expand: vi.fn(),
    onEvent: vi.fn((event: string, handler: Handler) => {
      if (!events.has(event)) events.set(event, new Set());
      events.get(event)?.add(handler);
    }),
    offEvent: vi.fn((event: string, handler: Handler) => {
      events.get(event)?.delete(handler);
    }),
    BackButton: {
      show: vi.fn(),
      hide: vi.fn(),
      onClick: vi.fn((handler: Handler) => backHandlers.add(handler)),
      offClick: vi.fn((handler: Handler) => backHandlers.delete(handler)),
    },
    /** Позвать подписчиков события — так это делает клиент Telegram. */
    fire: (event: string) => events.get(event)?.forEach((handler) => handler()),
    pressBack: () => backHandlers.forEach((handler) => handler()),
    ...over,
  };
}

afterEach(() => {
  delete window.Telegram;
  delete document.documentElement.dataset.theme;
  vi.clearAllMocks();
});

describe("без скрипта Telegram", () => {
  it("ничего не требует и ни на чём не падает", () => {
    expect(inTelegram()).toBe(false);
    expect(initData()).toBe("");
    expect(() => start()).not.toThrow();
    expect(attachNativeBack(() => undefined)).toBeUndefined();
    expect(() => followTheme()()).not.toThrow();
  });

  it("не трогает тему документа", () => {
    followTheme();

    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});

/**
 * Обычный браузер со скриптом Telegram.
 *
 * `telegram-web-app.js` подключён в `index.html` безусловно и создаёт
 * `window.Telegram.WebApp` где угодно — с `platform: "unknown"`, пустым
 * `initData` и заглушками вместо кнопок. Понадеявшись на сам объект,
 * приложение спрятало бы свою кнопку «назад» ради нативной, которой нет,
 * и уйти с карточки товара было бы нечем.
 */
describe("вне Telegram, но со скриптом", () => {
  beforeEach(() => {
    window.Telegram = {
      WebApp: fakeWebApp({ platform: "unknown", initData: "" }) as never,
    };
  });

  it("не считает себя открытым в Telegram", () => {
    expect(inTelegram()).toBe(false);
  });

  it("оставляет кнопку «назад» шапке, а не заглушке клиента", () => {
    expect(attachNativeBack(() => undefined)).toBeUndefined();
  });

  it("не трогает ни тему, ни заставку", () => {
    const webApp = window.Telegram?.WebApp as unknown as ReturnType<typeof fakeWebApp>;

    followTheme();
    start();

    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(webApp.ready).not.toHaveBeenCalled();
  });

  // Пустой `initData` — второй признак: если клиент вдруг не сообщил platform,
  // входить всё равно нечем.
  it("узнаёт браузер и по пустому initData, когда platform не сообщён", () => {
    window.Telegram = {
      WebApp: fakeWebApp({ platform: undefined, initData: "" }) as never,
    };

    expect(inTelegram()).toBe(false);
  });
});

describe("внутри Telegram", () => {
  let webApp: ReturnType<typeof fakeWebApp>;

  beforeEach(() => {
    webApp = fakeWebApp();
    window.Telegram = { WebApp: webApp as never };
  });

  it("узнаёт себя и отдаёт initData", () => {
    expect(inTelegram()).toBe(true);
    expect(initData()).toBe("user=%7B%22id%22%3A1%7D&hash=abc");
  });

  // Без `ready()` клиент держит заставку, без `expand()` Mini App открывается
  // половиной экрана — на каталоге это половина первого ряда плиток.
  it("сообщает о готовности и разворачивает окно", () => {
    start();

    expect(webApp.ready).toHaveBeenCalled();
    expect(webApp.expand).toHaveBeenCalled();
  });

  it("переживает клиент без expand", () => {
    window.Telegram = { WebApp: fakeWebApp({ expand: undefined }) as never };

    expect(() => start()).not.toThrow();
  });
});

describe("тема", () => {
  it("берёт тему из клиента", () => {
    window.Telegram = { WebApp: fakeWebApp({ colorScheme: "dark" }) as never };

    followTheme();

    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("следит за сменой темы на лету", () => {
    const webApp = fakeWebApp({ colorScheme: "light" });
    window.Telegram = { WebApp: webApp as never };
    followTheme();

    webApp.colorScheme = "dark";
    webApp.fire("themeChanged");

    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("отписка перестаёт слушать", () => {
    const webApp = fakeWebApp({ colorScheme: "light" });
    window.Telegram = { WebApp: webApp as never };

    followTheme()();
    webApp.colorScheme = "dark";
    webApp.fire("themeChanged");

    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

describe("нативная кнопка «назад»", () => {
  it("показывается и зовёт обработчик", () => {
    const webApp = fakeWebApp();
    window.Telegram = { WebApp: webApp as never };
    const onBack = vi.fn();

    const stop = attachNativeBack(onBack);
    webApp.pressBack();

    expect(webApp.BackButton.show).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
    expect(stop).toBeTypeOf("function");
  });

  // Иначе кнопка осталась бы висеть на экране, где её быть не должно, —
  // например, в каталоге после возврата из карточки.
  it("прячется при отписке", () => {
    const webApp = fakeWebApp();
    window.Telegram = { WebApp: webApp as never };
    const onBack = vi.fn();

    attachNativeBack(onBack)?.();
    webApp.pressBack();

    expect(webApp.BackButton.hide).toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });

  it("в клиенте без кнопки отдаёт undefined, чтобы шапка нарисовала свою", () => {
    window.Telegram = { WebApp: fakeWebApp({ BackButton: undefined }) as never };

    expect(attachNativeBack(() => undefined)).toBeUndefined();
  });
});

describe("initDataUserId", () => {
  // Подпись проверяет бэкенд; здесь нужно лишь понять, тот ли это аккаунт,
  // под которым лежит сохранённый токен.
  it("достаёт идентификатор из initData", () => {
    window.Telegram = {
      WebApp: fakeWebApp({
        initData: `user=${encodeURIComponent(JSON.stringify({ id: 5140053721 }))}&hash=abc`,
      }) as never,
    };

    expect(initDataUserId()).toBe("5140053721");
  });

  it("без данных и на мусоре отдаёт null, а не падает", () => {
    expect(initDataUserId()).toBeNull();

    window.Telegram = { WebApp: fakeWebApp({ initData: "user=%7Bсломано&hash=a" }) as never };
    expect(initDataUserId()).toBeNull();

    window.Telegram = { WebApp: fakeWebApp({ initData: "hash=a" }) as never };
    expect(initDataUserId()).toBeNull();
  });
});
