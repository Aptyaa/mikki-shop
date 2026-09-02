export interface HealthStatus {
  status: "ok";
}

/** Тон плашки на карточке товара — значения совпадают с `Tag` из дизайн-системы. */
export type TagTone = "new" | "sale" | "soft" | "neutral" | "outline";

/**
 * Размерная сетка магазина.
 *
 * Здесь только тип: пакет собирается в CommonJS ради NestJS, поэтому любое
 * значение в нём ломает ESM-импорт из Vite. Сам список размеров — данные, а не
 * контракт: он приходит с бэкенда в `CatalogResponse.sizes`.
 */
export type CatalogSize = "XS" | "S" | "M" | "L" | "XL";

export type CatalogSort = "pop" | "new" | "cheap";

export interface CatalogCategory {
  /** Ключ для фильтра: `sweaters`, `outer`, ... Псевдокатегории `all` в ответе нет. */
  key: string;
  label: string;
  /** Сколько товаров в категории. */
  count: number;
}

export interface CatalogProduct {
  id: string;
  slug: string;
  /** Ключ категории, не её id. */
  category: string;
  title: string;
  /** Целые рубли, без копеек. */
  price: number;
  was?: number;
  tag?: string;
  tagTone?: TagTone;
  sizes: CatalogSize[];
  soldOut: boolean;
  /** Заметка об остатке, если он мал: «Остался последний размер S». */
  stockNote?: string;
}

export interface CatalogQuery {
  /** Ключ категории или `all`. */
  category?: string;
  size?: CatalogSize;
  sort?: CatalogSort;
  /** Поиск по названию. */
  q?: string;
}

export interface CatalogResponse {
  items: CatalogProduct[];
  /** Всего товаров в каталоге без учёта фильтров — для «Показано N из M». */
  total: number;
  /** Вся размерная сетка магазина, по порядку — из неё рисуется фильтр. */
  sizes: CatalogSize[];
  /** Из них те, что есть у товаров текущей выборки (без учёта фильтра по размеру). */
  availableSizes: CatalogSize[];
}
