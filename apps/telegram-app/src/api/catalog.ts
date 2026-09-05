import type {
  AuthSession,
  CartItemInput,
  CartPreview,
  CatalogCategory,
  CatalogQuery,
  CatalogResponse,
  Order,
  OrderDraft,
  Pet,
  PetDraft,
  ProductDetail,
} from "@mikki-shop/shared-types";
import { bearerToken, useAuth } from "../lib/auth";

// Пусто при сборке без переменной — тогда запрос уйдёт на тот же origin,
// что и приложение. Значение задаётся в корневом .env (VITE_API_URL).
const BASE_URL: string = import.meta.env.VITE_API_URL ?? "";

/**
 * Заголовки запроса. Токен подставляется, только если он есть и не истёк:
 * каталог и корзина публичные, и гостю они отвечают тем же.
 */
function headers(extra?: Record<string, string>): Record<string, string> {
  const token = bearerToken();
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Ошибка запроса с кодом ответа.
 *
 * Код нужен экрану товара: 404 — это «такого товара нет», отдельный текст и
 * дорога назад в каталог, а не «проверьте соединение и попробуйте снова».
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /**
     * Причина и текст от бэкенда, если он их прислал.
     *
     * По одному коду ответа не всегда понятно, что показать: `/pets` отвечает
     * 409 и на занятую кличку, и на упёршийся лимит питомцев, а это разные
     * сообщения у разных мест экрана.
     */
    readonly reason?: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Ошибка ответа вместе с разобранным телом.
 *
 * Тело читается через `try`: у 204 его нет вовсе, у падения прокси оно не
 * JSON, и разбор не должен подменять собой настоящую причину — код ответа.
 */
async function failure(response: Response, path: string): Promise<HttpError> {
  forgetSessionOn(response.status);

  let reason: string | undefined;
  let detail: string | undefined;
  try {
    const body = (await response.json()) as { reason?: unknown; message?: unknown };
    if (typeof body?.reason === "string") reason = body.reason;
    if (typeof body?.message === "string") detail = body.message;
  } catch {
    // Тела нет или оно не JSON — остаётся код ответа, его и хватит.
  }

  return new HttpError(response.status, `${path}: HTTP ${response.status}`, reason, detail);
}

/**
 * Сервер не принял токен.
 *
 * Годность токена на клиенте меряется только его же `expiresAt`, а сервер
 * может отказать раньше: сменился `JWT_SECRET`, пропала строка покупателя.
 * Без сброса сессия залипла бы мёртвой до конца месячного срока, хотя
 * `initData` для нового входа под рукой на каждом старте.
 */
function forgetSessionOn(status: number): void {
  if (status === 401) useAuth.getState().signOut();
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { headers: headers(), signal });
  if (!response.ok) throw await failure(response, path);
  return (await response.json()) as T;
}

async function send<T>(
  method: "POST" | "PATCH",
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw await failure(response, path);
  return (await response.json()) as T;
}

function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return send<T>("POST", path, body, signal);
}

export function fetchCategories(signal?: AbortSignal): Promise<CatalogCategory[]> {
  return get<CatalogCategory[]>("/catalog/categories", signal);
}

export function fetchProducts(query: CatalogQuery, signal?: AbortSignal): Promise<CatalogResponse> {
  const params = new URLSearchParams();
  if (query.category && query.category !== "all") params.set("category", query.category);
  if (query.size) params.set("size", query.size);
  if (query.sort) params.set("sort", query.sort);
  if (query.q) params.set("q", query.q);
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.offset) params.set("offset", String(query.offset));

  const search = params.toString();
  return get<CatalogResponse>(`/catalog/products${search ? `?${search}` : ""}`, signal);
}

export function fetchProduct(slug: string, signal?: AbortSignal): Promise<ProductDetail> {
  return get<ProductDetail>(`/catalog/products/${encodeURIComponent(slug)}`, signal);
}

/**
 * Пересчёт корзины на бэкенде: названия, цены и наличие берутся из каталога,
 * а не из того, что клиент сложил себе в `localStorage`.
 */
export function fetchCartPreview(
  items: CartItemInput[],
  signal?: AbortSignal,
): Promise<CartPreview> {
  return post<CartPreview>("/cart/preview", { items }, signal);
}

/** Обмен `initData` из Mini App на токен покупателя. */
export function login(initData: string, signal?: AbortSignal): Promise<AuthSession> {
  return post<AuthSession>("/auth/telegram", { initData }, signal);
}

/** Оформление заказа. Требует входа: заказ надо к кому-то привязать. */
export function createOrder(draft: OrderDraft, signal?: AbortSignal): Promise<Order> {
  return post<Order>("/orders", draft, signal);
}

export function fetchOrders(signal?: AbortSignal): Promise<Order[]> {
  return get<Order[]>("/orders", signal);
}

/** Питомцы покупателя. Требует входа: чужие собаки никого не касаются. */
export function fetchPets(signal?: AbortSignal): Promise<Pet[]> {
  return get<Pet[]>("/pets", signal);
}

export function createPet(draft: PetDraft, signal?: AbortSignal): Promise<Pet> {
  return post<Pet>("/pets", draft, signal);
}

export function updatePet(id: string, draft: PetDraft, signal?: AbortSignal): Promise<Pet> {
  return send<Pet>("PATCH", `/pets/${encodeURIComponent(id)}`, draft, signal);
}

/** Удаление. Ответ пустой (204), поэтому разбирать тело нечего. */
export async function deletePet(id: string, signal?: AbortSignal): Promise<void> {
  const path = `/pets/${encodeURIComponent(id)}`;
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: headers(),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw await failure(response, path);
}
