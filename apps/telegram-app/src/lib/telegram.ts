/**
 * Адаптер Telegram Mini App.
 *
 * Тонкая обёртка над `window.Telegram.WebApp` из официального
 * `telegram-web-app.js`, а не `@telegram-apps/sdk`, который упомянут в
 * `ARCHITECTURE.md`. Причина: из всего SDK нужны `initData`, тема, полный
 * экран и отступы — на это уходит меньше кода, чем весит сам SDK, а его модель
 * инициализации пришлось бы всё равно оборачивать. Если понадобятся платежи,
 * биометрия или облачное хранилище — SDK вернётся, и заменить придётся
 * ровно этот файл.
 *
 * Вне Telegram (обычный браузер, тесты, витрина) объекта нет, и приложение
 * работает как гость: каталог публичный, вход просто не происходит.
 */

/** Отступы со всех сторон, как их отдаёт клиент. */
interface Insets {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

/** То, чем мы пользуемся из `window.Telegram.WebApp`. */
interface TelegramWebApp {
  initData: string;
  /** Вне Telegram — `"unknown"`. Это и есть признак настоящего клиента. */
  platform?: string;
  colorScheme?: "light" | "dark";
  ready: () => void;
  expand?: () => void;
  /** Есть с Bot API 8.0. Вне его — метода просто нет, и это нормально. */
  requestFullscreen?: () => void;
  isVersionAtLeast?: (version: string) => boolean;
  /** Вырез и скруглённые углы устройства. Bot API 8.0. */
  safeAreaInset?: Insets;
  /** Место, занятое собственными кнопками клиента поверх приложения. 8.0. */
  contentSafeAreaInset?: Insets;
  onEvent?: (event: string, handler: () => void) => void;
  offEvent?: (event: string, handler: () => void) => void;
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
 * Версия Mini App, с которой Telegram умеет полноэкранный режим.
 *
 * Проверять обязательно: у клиента постарше метода нет вовсе, а `?.` спасёт
 * от падения, но не от того, что приложение молча останется в шапке.
 */
const FULLSCREEN_SINCE = "8.0";

/**
 * Сообщить Telegram, что интерфейс готов, развернуть окно и убрать его шапку.
 *
 * Без `ready()` клиент держит заставку, без `expand()` Mini App открывается
 * половиной экрана — на каталоге это половина первого ряда плиток.
 *
 * **`requestFullscreen()` — потому что иначе вид зависит от способа запуска.**
 * Из кнопки меню бота клиент рисует сверху свою полосу с именем бота и
 * «Назад», а из чата приложение открывается без неё. Один и тот же магазин
 * выглядел по-разному в зависимости от того, откуда в него зашли. Полный экран
 * убирает полосу везде: остаются только плавающие кнопки клиента поверх
 * содержимого, а место под них резервирует `--safe-top` (см. `followInsets`).
 *
 * Отказ не обрабатываем: клиент отвечает на него событием `fullscreenFailed`,
 * а приложение при этом остаётся ровно тем, чем было до просьбы, — работающим
 * в обычном режиме.
 */
export function start(): void {
  const webApp = app();
  if (!webApp || !inTelegram()) return;
  webApp.ready();
  webApp.expand?.();
  if (webApp.isVersionAtLeast?.(FULLSCREEN_SINCE)) webApp.requestFullscreen?.();
}

/**
 * События, после которых отступы могут стать другими.
 *
 * `viewportChanged` в списке не для красоты: на части клиентов вебвью меняет
 * размер уже после входа в полный экран, и без него первая отрисовка осталась
 * бы с отступами предыдущего режима.
 */
const INSET_EVENTS = [
  "safeAreaChanged",
  "contentSafeAreaChanged",
  "fullscreenChanged",
  "viewportChanged",
];

/**
 * Отступы клиента в токены кита `--safe-top` / `--safe-bottom`.
 *
 * В полном экране приложение рисует под вырезом устройства и под плавающими
 * кнопками самого Telegram — заголовок раздела оказался бы под часами, а
 * «Закрыть» легло бы на кнопку поиска. Клиент отдаёт оба запаса отдельно:
 * `safeAreaInset` — это устройство (вырез, скруглённые углы), а
 * `contentSafeAreaInset` — его собственные кнопки. Складываем: занято и то, и
 * другое.
 *
 * **Токены не трогаем, если клиент отступов не даёт** (Bot API младше 8.0,
 * обычный браузер, тесты). В ките они посчитаны из `env(safe-area-inset-*)`,
 * и записать туда ноль значило бы стереть рабочее значение ради пустого.
 */
export function followInsets(): () => void {
  const webApp = inTelegram() ? app() : undefined;

  const apply = () => {
    const safe = webApp?.safeAreaInset;
    const content = webApp?.contentSafeAreaInset;
    if (!safe && !content) return;

    const sum = (side: keyof Insets) => (safe?.[side] ?? 0) + (content?.[side] ?? 0);
    const root = document.documentElement.style;
    root.setProperty("--safe-top", `${sum("top")}px`);
    root.setProperty("--safe-bottom", `${sum("bottom")}px`);
  };

  apply();
  if (!webApp?.onEvent) return () => undefined;

  for (const event of INSET_EVENTS) webApp.onEvent(event, apply);
  return () => {
    for (const event of INSET_EVENTS) webApp.offEvent?.(event, apply);
  };
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
