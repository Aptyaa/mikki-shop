/**
 * Адаптер Telegram Mini App.
 *
 * Тонкая обёртка над `window.Telegram.WebApp` из официального
 * `telegram-web-app.js`, а не `@telegram-apps/sdk`, который упомянут в
 * `ARCHITECTURE.md`. Причина: из всего SDK нужны `initData`, тема и кнопка
 * «назад» — на это уходит меньше кода, чем весит сам SDK, а его модель
 * инициализации пришлось бы всё равно оборачивать. Если понадобятся платежи,
 * биометрия или облачное хранилище — SDK вернётся, и заменить придётся
 * ровно этот файл.
 *
 * Вне Telegram (обычный браузер, тесты, витрина) объекта нет, и приложение
 * работает как гость: каталог публичный, вход просто не происходит.
 */

/** То, чем мы пользуемся из `window.Telegram.WebApp`. */
interface TelegramWebApp {
  initData: string;
  /** Вне Telegram — `"unknown"`. Это и есть признак настоящего клиента. */
  platform?: string;
  colorScheme?: "light" | "dark";
  ready: () => void;
  expand?: () => void;
  onEvent?: (event: string, handler: () => void) => void;
  offEvent?: (event: string, handler: () => void) => void;
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (handler: () => void) => void;
    offClick: (handler: () => void) => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

function app(): TelegramWebApp | undefined {
  return typeof window === "undefined" ? undefined : window.Telegram?.WebApp;
}

/**
 * Открыто ли приложение внутри Telegram.
 *
 * Проверяется НЕ наличием `window.Telegram`: `telegram-web-app.js` создаёт его
 * в любом браузере — с `platform: "unknown"`, пустым `initData` и заглушками
 * вместо кнопок. Понадеявшись на объект, приложение в браузере пряталo бы свою
 * кнопку «назад» ради нативной, которой нет, и уйти с карточки было бы нечем.
 */
export function inTelegram(): boolean {
  const webApp = app();
  if (!webApp) return false;
  // `platform` — прямой ответ клиента; `initData` — запасной признак на случай,
  // если поля не окажется: заглушка в браузере оставляет его пустым.
  const platform = webApp.platform;
  if (platform) return platform !== "unknown";
  return webApp.initData !== "";
}

/** `initData` для входа. Пусто вне Telegram — тогда входить не с чем. */
export function initData(): string {
  return app()?.initData ?? "";
}

/**
 * Сообщить Telegram, что интерфейс готов, и развернуть окно на всю высоту.
 *
 * Без `ready()` клиент держит заставку, без `expand()` Mini App открывается
 * половиной экрана — на каталоге это половина первого ряда плиток.
 */
export function start(): void {
  const webApp = app();
  if (!webApp || !inTelegram()) return;
  webApp.ready();
  webApp.expand?.();
}

/**
 * Тема из Telegram: пользователь выбирает её в клиенте, а не у нас.
 *
 * Токены тёмной темы в ките готовы с самого начала и ждали ровно этого —
 * `data-theme` на корне документа. Возвращает функцию отписки.
 */
export function followTheme(): () => void {
  const webApp = inTelegram() ? app() : undefined;
  const apply = () => {
    const scheme = webApp?.colorScheme;
    if (scheme) document.documentElement.dataset.theme = scheme;
  };

  apply();
  if (!webApp?.onEvent) return () => undefined;

  webApp.onEvent("themeChanged", apply);
  return () => webApp.offEvent?.("themeChanged", apply);
}

/**
 * Нативная кнопка «назад» Telegram.
 *
 * Своя кнопка в шапке остаётся для браузера. Внутри Telegram она прячется:
 * две кнопки «назад» рядом — это не забота, а вопрос «какая из них моя».
 * Возвращает функцию отписки; `undefined` — кнопки нет, рисуем свою.
 */
export function attachNativeBack(onBack: () => void): (() => void) | undefined {
  const button = inTelegram() ? app()?.BackButton : undefined;
  if (!button) return undefined;

  button.onClick(onBack);
  button.show();
  return () => {
    button.offClick(onBack);
    button.hide();
  };
}

/**
 * Идентификатор пользователя из `initData`, без проверки подписи.
 *
 * Подпись проверяет бэкенд — здесь нужно лишь понять, тот ли это аккаунт, под
 * которым лежит сохранённый токен. Хранилище Mini App общее для всех аккаунтов
 * одного клиента, так что после переключения аккаунта токен в нём чужой.
 */
export function initDataUserId(): string | null {
  const raw = new URLSearchParams(initData()).get("user");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { id?: unknown };
    if (typeof parsed.id === "number" && Number.isFinite(parsed.id)) return String(parsed.id);
    if (typeof parsed.id === "string" && parsed.id.trim()) return parsed.id.trim();
    return null;
  } catch {
    return null;
  }
}
