import type { CatalogSize, CatalogSort, TagTone } from "@mikki-shop/shared-types";

/** Размерная сетка магазина, по порядку. Бэкенд — её источник правды. */
export const CATALOG_SIZES: readonly CatalogSize[] = ["XS", "S", "M", "L", "XL"];

export const CATALOG_SORTS: readonly CatalogSort[] = ["pop", "new", "cheap"];

export const TAG_TONES: readonly TagTone[] = ["new", "sale", "soft", "neutral", "outline"];

/** Страница каталога: 8 товаров — четыре ряда сетки 2×N на 390pt. */
export const CATALOG_PAGE_SIZE = 8;
export const CATALOG_PAGE_SIZE_MAX = 48;
