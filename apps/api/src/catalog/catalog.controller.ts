import { Controller, Get, Query } from "@nestjs/common";
import type {
  CatalogCategory,
  CatalogResponse,
  CatalogSize,
  CatalogSort,
} from "@mikki-shop/shared-types";
import { CatalogService } from "./catalog.service";
import { CATALOG_SIZES, CATALOG_SORTS } from "./catalog.constants";

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
  ): Promise<CatalogResponse> {
    // Значения из query приходят от клиента: всё, что не входит в известный
    // набор, отбрасывается, а не передаётся в запрос к БД.
    return this.catalog.products({
      ...(category ? { category } : {}),
      ...(size && (CATALOG_SIZES as readonly string[]).includes(size)
        ? { size: size as CatalogSize }
        : {}),
      ...(sort && (CATALOG_SORTS as readonly string[]).includes(sort)
        ? { sort: sort as CatalogSort }
        : {}),
      ...(q && q.trim() ? { q: q.trim().slice(0, 100) } : {}),
    });
  }
}
