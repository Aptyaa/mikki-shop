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

/**
 * Позиция корзины в том виде, в каком её хранит клиент.
 *
 * Ни названия, ни цены здесь нет намеренно: и то и другое живёт в каталоге и
 * меняется. Корзина в браузере помнит только «что выбрали», а как это сейчас
 * называется и сколько стоит — считает бэкенд.
 */
export interface CartItemInput {
  slug: string;
  size: CatalogSize;
  /** Название расцветки. Пусто — у товара расцветок нет. */
  color?: string;
  quantity: number;
}

/** Строка корзины, пересчитанная бэкендом. */
export interface CartLineDto {
  slug: string;
  title: string;
  size: CatalogSize;
  color?: string;
  /** Цена за штуку — с бэкенда, а не из localStorage клиента. */
  price: number;
  was?: number;
  /** Сколько лежит в корзине, как её прислал клиент. */
  quantity: number;
  /**
   * Сколько этого размера можно взять сейчас: ноль — размера нет в наличии.
   * Точный остаток наружу не отдаётся, число ограничено сверху лимитом позиции.
   */
  maxQuantity: number;
  /** `price × quantity`, но не больше, чем `maxQuantity` штук. */
  lineTotal: number;
}

export interface CartPreview {
  lines: CartLineDto[];
  /** Слаги позиций, которых больше нет в каталоге, — их клиенту стоит выкинуть. */
  gone: string[];
  /** Сумма по тому, что реально можно купить. */
  total: number;
  /** Сколько штук всего — для счётчика в шапке. */
  count: number;
  /** Есть ли строки, где выбранного количества нет в наличии. */
  hasShortage: boolean;
}

/** Покупатель — то, что фронт знает о вошедшем пользователе. */
export interface AuthUser {
  id: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  isPremium: boolean;
}

/** Ответ на вход: токен и профиль. */
export interface AuthSession {
  /** JWT для заголовка `Authorization: Bearer`. */
  token: string;
  /** Когда токен истекает — миллисекунды эпохи. */
  expiresAt: number;
  user: AuthUser;
}

/** Способ получения заказа. */
export type DeliveryMethod = "courier" | "pickup" | "post";

/** Что происходит с заказом. Оплаты пока нет — заявку ведёт менеджер. */
export type OrderStatus = "NEW" | "CONFIRMED" | "SHIPPED" | "DONE" | "CANCELLED";

/** Что покупатель заполняет на оформлении. Позиции берутся из его корзины. */
export interface OrderDraft {
  customerName: string;
  phone: string;
  delivery: DeliveryMethod;
  /** Обязателен для курьера и почты, для самовывоза не нужен. */
  address?: string;
  comment?: string;
  /** Кличка питомца. Необязательна: заказ можно оформить и без неё. */
  petName?: string;
  /**
   * Согласие на обработку персональных данных (152-ФЗ).
   *
   * Обязательное: имя, телефон и адрес — это ПД, и без согласия их нельзя ни
   * хранить, ни передавать курьеру. Едет в запросе и проверяется на сервере,
   * а не только галочкой на экране: галочку в браузере снимает кто угодно, а
   * доказывать согласие придётся по конкретному заказу.
   */
  consent: boolean;
  items: CartItemInput[];
}

/** Строка заказа — слепок товара на момент покупки. */
export interface OrderLine {
  slug: string;
  title: string;
  size: CatalogSize;
  color?: string;
  /** Цена на момент заказа, а не текущая цена в каталоге. */
  price: number;
  quantity: number;
}

export interface Order {
  /** Короткий номер для разговора с менеджером: «заказ 1042». */
  number: number;
  status: OrderStatus;
  createdAt: string;
  customerName: string;
  phone: string;
  delivery: DeliveryMethod;
  address?: string;
  comment?: string;
  petName?: string;
  total: number;
  lines: OrderLine[];
}

/**
 * Почему заказ не удалось оформить.
 *
 * Отдельным кодом, а не текстом: `out-of-stock` экран показывает иначе —
 * ведёт в корзину поправить состав, а не предлагает «попробовать снова».
 */
export type OrderFailure = "empty-cart" | "out-of-stock" | "invalid";
