import { Controller, Get, Query } from "@nestjs/common";
import type {
  CatalogCategory,
  CatalogResponse,
  CatalogSize,
  CatalogSort,
} from "@mikki-shop/shared-types";
import { CatalogService } from "./catalog.service";
import {
  CATALOG_PAGE_SIZE,
  CATALOG_PAGE_SIZE_MAX,
  CATALOG_SIZES,
  CATALOG_SORTS,
} from "./catalog.constants";

/** Целое число из query, иначе `fallback`; отрицательные и мусор отбрасываются. */
function toInt(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

/** Публичный каталог: читается без авторизации, так и задумано. */
@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("categories")
  categories(): Promise<CatalogCategory[]> {
    return this.catalog.categories();
  }

  @Get("products")
  products(
    @Query("category") category?: string,
    @Query("size") size?: string,
    @Query("sort") sort?: string,
    @Query("q") q?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ): Promise<CatalogResponse> {
    // Значения из query приходят от клиента: размер, сортировка и числа
    // приводятся к известному набору. `category` сверяется не со списком, а с
    // данными — неизвестный ключ честно даёт пустую выдачу, а не весь каталог.
    return this.catalog.products({
      ...(category ? { category } : {}),
      ...(size && (CATALOG_SIZES as readonly string[]).includes(size)
        ? { size: size as CatalogSize }
        : {}),
      ...(sort && (CATALOG_SORTS as readonly string[]).includes(sort)
        ? { sort: sort as CatalogSort }
        : {}),
      ...(q && q.trim() ? { q: q.trim().slice(0, 100) } : {}),
      limit: Math.max(1, toInt(limit, CATALOG_PAGE_SIZE, CATALOG_PAGE_SIZE_MAX)),
      offset: toInt(offset, 0, Number.MAX_SAFE_INTEGER),
    });
  }
}
