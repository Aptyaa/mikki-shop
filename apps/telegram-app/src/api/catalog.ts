import type {
  CatalogCategory,
  CatalogQuery,
  CatalogResponse,
} from "@mikki-shop/shared-types";

// Пусто при сборке без переменной — тогда запрос уйдёт на тот же origin,
// что и приложение. Значение задаётся в корневом .env (VITE_API_URL).
const BASE_URL: string = import.meta.env.VITE_API_URL ?? "";

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { signal });
  if (!response.ok) {
    throw new Error(`${path}: HTTP ${response.status}`);
  }
  return (await response.json()) as T;
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

  const search = params.toString();
  return get<CatalogResponse>(`/catalog/products${search ? `?${search}` : ""}`, signal);
}
