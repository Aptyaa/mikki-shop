import type { CatalogSize, CatalogSort, TagTone } from "@mikki-shop/shared-types";

/** Размерная сетка магазина, по порядку. Бэкенд — её источник правды. */
export const CATALOG_SIZES: readonly CatalogSize[] = ["XS", "S", "M", "L", "XL"];

export const CATALOG_SORTS: readonly CatalogSort[] = ["pop", "new", "cheap"];

export const TAG_TONES: readonly TagTone[] = ["new", "sale", "soft", "neutral", "outline"];
