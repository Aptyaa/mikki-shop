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
  /** Размер страницы. Бэкенд подставит свой по умолчанию и ограничит максимум. */
  limit?: number;
  /** Сколько товаров пропустить — подгрузка следующей страницы. */
  offset?: number;
}

export interface CatalogResponse {
  /** Одна страница выдачи, не весь список. */
  items: CatalogProduct[];
  /** Сколько товаров подходит под текущий фильтр — для «Показано N из M». */
  matched: number;
  /** Всего товаров в каталоге без учёта фильтров — для подзаголовка шапки. */
  total: number;
  /** Смещение и размер отданной страницы: по ним считается следующая. */
  offset: number;
  limit: number;
  /** Вся размерная сетка магазина, по порядку — из неё рисуется фильтр. */
  sizes: CatalogSize[];
  /** Из них те, что есть у товаров текущей выборки (без учёта фильтра по размеру). */
  availableSizes: CatalogSize[];
}

/**
 * Расцветка товара. Имя показывается рядом со свотчами: одних кружков мало —
 * по ним не прочитать название и нечего озвучить скринридеру.
 */
export interface ProductColor {
  name: string;
  /** HEX самой ткани. Это данные о товаре, а не цвет интерфейса — токена под него нет. */
  hex: string;
}

/** Строка размерной сетки товара: наличие и мерки для таблицы размеров. */
export interface ProductSizeRow {
  size: CatalogSize;
  /** Есть ли что отгрузить. Точный остаток наружу не отдаётся. */
  available: boolean;
  /** Обхват груди в сантиметрах, диапазоном: «34–40». Пусто, если мерки не заведены. */
  chest?: string;
  /** Обхват шеи, см. */
  neck?: string;
  /** Длина спины, см. */
  back?: string;
}

/**
 * Карточка товара — то же, что плитка каталога, плюс всё, что нужно на
 * отдельном экране. Наследует `CatalogProduct`, чтобы карточку можно было
 * передать в те же компоненты, что и элемент выдачи.
 */
export interface ProductDetail extends CatalogProduct {
  /** Название категории для шапки экрана: «Дождевики», а не `rain`. */
  categoryLabel: string;
  description?: string;
  /** Состав: «меринос 70%, акрил 30%». */
  composition?: string;
  /** Уход одной строкой. */
  care?: string;
  /** Средняя оценка. Звёзды показываются только начиная с трёх отзывов. */
  rating?: number;
  reviewCount: number;
  /** Фотографии по порядку. Пока пусто у всех товаров — место держит `PhotoSlot`. */
  photos: string[];
  colors: ProductColor[];
  /** Сетка товара в порядке размерной сетки магазина. */
  sizeRows: ProductSizeRow[];
}
