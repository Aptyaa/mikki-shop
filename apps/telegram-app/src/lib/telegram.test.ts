// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  followInsets,
  followTheme,
  inTelegram,
  initData,
  initDataUserId,
  start,
} from "./telegram";

type Handler = () => void;

function fakeWebApp(over: Record<string, unknown> = {}) {
  const events = new Map<string, Set<Handler>>();

  return {
    initData: "user=%7B%22id%22%3A1%7D&hash=abc",
    platform: "ios",
    colorScheme: "light" as "light" | "dark",
    ready: vi.fn(),
    expand: vi.fn(),
    isVersionAtLeast: vi.fn((version: string) => version <= "8.0"),
    requestFullscreen: vi.fn(),
    safeAreaInset: { top: 47, bottom: 34, left: 0, right: 0 },
    contentSafeAreaInset: { top: 46, bottom: 0, left: 0, right: 0 },
    onEvent: vi.fn((event: string, handler: Handler) => {
      if (!events.has(event)) events.set(event, new Set());
      events.get(event)?.add(handler);
    }),
    offEvent: vi.fn((event: string, handler: Handler) => {
      events.get(event)?.delete(handler);
    }),
    /** Позвать подписчиков события — так это делает клиент Telegram. */
    fire: (event: string) => events.get(event)?.forEach((handler) => handler()),
    ...over,
  };
}

afterEach(() => {
  delete window.Telegram;
  delete document.documentElement.dataset.theme;
  document.documentElement.style.removeProperty("--safe-top");
  document.documentElement.style.removeProperty("--safe-bottom");
  vi.clearAllMocks();
});

describe("без скрипта Telegram", () => {
  it("ничего не требует и ни на чём не падает", () => {
    expect(inTelegram()).toBe(false);
    expect(initData()).toBe("");
    expect(() => start()).not.toThrow();
    expect(() => followTheme()()).not.toThrow();
    expect(() => followInsets()()).not.toThrow();
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

  // Иначе вид приложения зависит от того, откуда его открыли: из кнопки меню
  // бота клиент рисует сверху свою полосу с именем бота и «Назад», из чата —
  // нет. Полный экран убирает полосу везде.
  it("просит полный экран", () => {
    start();

    expect(webApp.requestFullscreen).toHaveBeenCalled();
  });

  // У клиента младше 8.0 метода нет вовсе. `?.` спас бы от падения, но просить
  // всё равно нечего — а вот проверять версию обязательно.
  it("не просит полного экрана у старого клиента", () => {
    const old = fakeWebApp({
      isVersionAtLeast: vi.fn(() => false),
      requestFullscreen: vi.fn(),
    });
    window.Telegram = { WebApp: old as never };

    start();

    expect(old.requestFullscreen).not.toHaveBeenCalled();
  });
});

describe("отступы клиента", () => {
  const safeTop = () => document.documentElement.style.getPropertyValue("--safe-top");
  const safeBottom = () => document.documentElement.style.getPropertyValue("--safe-bottom");

  // Вырез устройства и плавающие кнопки Telegram — два разных запаса, занято
  // и то, и другое: 47 + 46 сверху, 34 + 0 снизу.
  it("складывает вырез устройства и место под кнопки клиента", () => {
    window.Telegram = { WebApp: fakeWebApp() as never };

    followInsets();

    expect(safeTop()).toBe("93px");
    expect(safeBottom()).toBe("34px");
  });

  it("пересчитывает по событию клиента и отписывается", () => {
    const webApp = fakeWebApp();
    window.Telegram = { WebApp: webApp as never };

    const stop = followInsets();
    webApp.safeAreaInset = { top: 0, bottom: 0, left: 0, right: 0 };
    webApp.contentSafeAreaInset = { top: 56, bottom: 0, left: 0, right: 0 };
    webApp.fire("fullscreenChanged");
    expect(safeTop()).toBe("56px");

    stop();
    webApp.contentSafeAreaInset = { top: 99, bottom: 0, left: 0, right: 0 };
    webApp.fire("fullscreenChanged");
    expect(safeTop()).toBe("56px");
  });

  // У клиента младше 8.0 полей нет. Записать туда ноль значило бы стереть
  // рабочее `env(safe-area-inset-*)` из токенов кита ради пустого значения.
  it("не трогает токены, когда клиент отступов не даёт", () => {
    window.Telegram = {
      WebApp: fakeWebApp({
        safeAreaInset: undefined,
        contentSafeAreaInset: undefined,
      }) as never,
    };

    followInsets();

    expect(safeTop()).toBe("");
    expect(safeBottom()).toBe("");
  });

  // В браузере клиента нет, а `env()` в токенах есть — трогать нечего.
  it("не трогает токены вне Telegram", () => {
    window.Telegram = {
      WebApp: fakeWebApp({ platform: "unknown", initData: "" }) as never,
    };

    followInsets();

    expect(safeTop()).toBe("");
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
