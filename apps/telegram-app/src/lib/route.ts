import { useSyncExternalStore } from "react";

/**
 * Экран приложения. Роутер держится на хэше (`#/product/<slug>`), а не на
 * History API: Mini App отдаётся статикой, и путь `/product/...` при
 * перезагрузке ушёл бы на сервер, которого под этим адресом нет.
 *
 * Своя реализация вместо роутера-библиотеки: экранов немного, а хэш даёт то,
 * ради чего роутер и берут, — рабочую кнопку «назад» в браузере и в вебвью
 * Telegram, плюс ссылку на конкретный товар, которую можно переслать.
 *
 * Корень — стартовый экран, не каталог: приложение открывается витриной, с
 * которой в каталог уходят по кнопке. До появления `home` каталог стоял на
 * `#/`, поэтому у него теперь есть собственный адрес.
 */
export type Route =
  | { name: "home" }
  /** `category` — ключ категории, выбранной снаружи (со стартового экрана). */
  | { name: "catalog"; category?: string }
  | { name: "product"; slug: string }
  | { name: "cart" }
  | { name: "checkout" }
  | { name: "orders" };

const PRODUCT = /^#\/product\/([^/?#]+)/;

/**
 * Параметры после `?` в хэше.
 *
 * `URLSearchParams` разбирает битый percent-encoding молча, отдавая сырой
 * текст, — падать на правленом руками адресе здесь нечему.
 */
function queryOf(hash: string): URLSearchParams {
  const start = hash.indexOf("?");
  return new URLSearchParams(start === -1 ? "" : hash.slice(start + 1));
}

export function parseRoute(hash: string): Route {
  // Каталог проверяется до корзины: `\b` после `cart` не даст «#/catalog»
  // сойти за корзину, но порядок делает это очевидным и без разбора регулярки.
  if (/^#\/catalog\b/.test(hash)) {
    const category = queryOf(hash).get("category")?.trim();
    return category ? { name: "catalog", category } : { name: "catalog" };
  }
  if (/^#\/cart\b/.test(hash)) return { name: "cart" };
  if (/^#\/checkout\b/.test(hash)) return { name: "checkout" };
  if (/^#\/orders\b/.test(hash)) return { name: "orders" };

  const match = PRODUCT.exec(hash);
  if (!match?.[1]) return { name: "home" };
  try {
    return { name: "product", slug: decodeURIComponent(match[1]) };
  } catch {
    // Битый percent-encoding в адресной строке — не повод падать белым экраном.
    return { name: "home" };
  }
}

export function routeToHash(route: Route): string {
  if (route.name === "product") return `#/product/${encodeURIComponent(route.slug)}`;
  if (route.name === "catalog") {
    return route.category
      ? `#/catalog?category=${encodeURIComponent(route.category)}`
      : "#/catalog";
  }
  if (route.name === "cart") return "#/cart";
  if (route.name === "checkout") return "#/checkout";
  if (route.name === "orders") return "#/orders";
  return "#/";
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/**
 * Снимок — сама строка хэша, а не разобранный объект: `useSyncExternalStore`
 * сравнивает снимки по ссылке, и новый объект на каждый вызов давал бы
 * бесконечный рендер.
 */
function getHash(): string {
  return window.location.hash;
}

export function useRoute(): Route {
  return parseRoute(useSyncExternalStore(subscribe, getHash, () => ""));
}

/**
 * Пометка на записи истории: этот адрес поставлен переходом внутри приложения.
 *
 * Метка живёт на самой записи, а не в переменной модуля: переменная пережила бы
 * перезагрузку страницы как `false`, хотя каталог в истории вкладки остался,
 * а на карточке, открытой по прямой ссылке, наоборот успела бы стать `true`.
 */
const OURS = { mikkiShop: true };

function pushedByUs(): boolean {
  return (window.history.state as { mikkiShop?: boolean } | null)?.mikkiShop === true;
}

/**
 * Переход на экран. По умолчанию добавляет запись в историю, чтобы «назад»
 * вело обратно; `replace` — подменяет текущую, когда возвращаться на прежний
 * экран незачем (со страницы «товара нет», например).
 */
export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  const { pathname, search } = window.location;
  const url = `${pathname}${search}${routeToHash(route)}`;

  if (options.replace) window.history.replaceState(OURS, "", url);
  else window.history.pushState(OURS, "", url);

  // Ни `pushState`, ни `replaceState` не шлют `hashchange` — событие досылается
  // вручную, иначе подписчики роутера не узнают, что адрес сменился.
  window.dispatchEvent(new Event("hashchange"));
}

/**
 * Назад. Если текущая запись не наша — экран открыли по прямой ссылке, и
 * `history.back()` либо ничего не сделает, либо уведёт из приложения совсем.
 * Тогда просто становимся на стартовый экран.
 */
export function goBack(): void {
  if (pushedByUs()) {
    window.history.back();
    return;
  }
  navigate({ name: "home" }, { replace: true });
}
