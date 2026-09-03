// Декораторы Nest (`@Controller`, `@Get`, `@Query`) пишут метаданные через
// `Reflect.defineMetadata`, которого в голом рантайме нет. Сам контейнер Nest
// здесь не поднимается — контроллер создаётся руками, — но полифил нужен,
// чтобы модуль вообще загрузился.
import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogQuery, CatalogResponse, ProductDetail } from "@mikki-shop/shared-types";
import { CatalogController } from "./catalog.controller";
import type { CatalogService } from "./catalog.service";

const EMPTY: CatalogResponse = {
  items: [],
  matched: 0,
  total: 0,
  offset: 0,
  limit: 8,
  sizes: [],
  availableSizes: [],
};

type Params = {
  category?: string;
  size?: string;
  sort?: string;
  q?: string;
  limit?: string;
  offset?: string;
};

const CARD: ProductDetail = {
  id: "p1",
  slug: "sviter-saharok",
  category: "sweaters",
  categoryLabel: "Свитеры",
  title: "Вязаный свитер «Сахарок»",
  price: 1490,
  sizes: ["S"],
  soldOut: false,
  reviewCount: 0,
  photos: [],
  colors: [],
  sizeRows: [{ size: "S", available: true }],
};

let products: ReturnType<typeof vi.fn>;
let categories: ReturnType<typeof vi.fn>;
let product: ReturnType<typeof vi.fn>;
let controller: CatalogController;

beforeEach(() => {
  products = vi.fn().mockResolvedValue(EMPTY);
  categories = vi.fn().mockResolvedValue([]);
  product = vi.fn().mockResolvedValue(CARD);
  controller = new CatalogController({
    products,
    categories,
    product,
  } as unknown as CatalogService);
});

/** Запрос, с которым контроллер сходил в сервис после разбора query. */
async function ask(params: Params = {}): Promise<CatalogQuery> {
  await controller.products(
    params.category,
    params.size,
    params.sort,
    params.q,
    params.limit,
    params.offset,
  );
  // Последний вызов, не первый: часть тестов дёргает `ask` несколько раз.
  return products.mock.calls.at(-1)?.[0] as CatalogQuery;
}

describe("CatalogController.products — страница", () => {
  it("без параметров просит первую страницу в 8 товаров", async () => {
    expect(await ask()).toEqual({ limit: 8, offset: 0 });
  });

  it("пропускает limit в пределах максимума", async () => {
    expect(await ask({ limit: "24" })).toMatchObject({ limit: 24 });
    expect(await ask({ limit: "48" })).toMatchObject({ limit: 48 });
  });

  // Верхняя граница — защита от `limit=99999`, которым можно выкачать каталог
  // одним запросом мимо пагинации.
  it("режет limit по максимуму", async () => {
    expect(await ask({ limit: "9999" })).toMatchObject({ limit: 48 });
  });

  it("возвращает мусорный и отрицательный limit к дефолту", async () => {
    expect(await ask({ limit: "abc" })).toMatchObject({ limit: 8 });
    expect(await ask({ limit: "-5" })).toMatchObject({ limit: 8 });
    expect(await ask({ limit: "" })).toMatchObject({ limit: 8 });
  });

  // `limit=0` — единственное значение, которое не уходит в дефолт: ноль
  // проходит проверку на отрицательность, и его подхватывает нижняя граница.
  // Пустую страницу это не даёт — запрос вернёт один товар.
  it("поднимает нулевой limit до одного товара, а не до дефолта", async () => {
    expect(await ask({ limit: "0" })).toMatchObject({ limit: 1 });
  });

  it("принимает смещение следующей страницы", async () => {
    expect(await ask({ offset: "16" })).toMatchObject({ offset: 16 });
  });

  it("возвращает мусорное и отрицательное смещение к нулю", async () => {
    expect(await ask({ offset: "abc" })).toMatchObject({ offset: 0 });
    expect(await ask({ offset: "-5" })).toMatchObject({ offset: 0 });
  });
});

describe("CatalogController.products — фильтры", () => {
  it("пропускает размер из сетки и отбрасывает остальное", async () => {
    expect(await ask({ size: "M" })).toMatchObject({ size: "M" });
    expect(await ask({ size: "XXL" })).not.toHaveProperty("size");
    expect(await ask({ size: "m" })).not.toHaveProperty("size");
  });

  it("пропускает известную сортировку и отбрасывает остальное", async () => {
    expect(await ask({ sort: "cheap" })).toMatchObject({ sort: "cheap" });
    expect(await ask({ sort: "price" })).not.toHaveProperty("sort");
  });

  it("подрезает поисковый запрос по краям", async () => {
    expect(await ask({ q: "  свитер  " })).toMatchObject({ q: "свитер" });
  });

  it("отбрасывает пустой поиск и поиск из одних пробелов", async () => {
    expect(await ask({ q: "" })).not.toHaveProperty("q");
    expect(await ask({ q: "   " })).not.toHaveProperty("q");
  });

  it("ограничивает длину поиска сотней символов", async () => {
    const query = await ask({ q: "а".repeat(500) });
    expect(query.q).toHaveLength(100);
  });

  // Категория намеренно не сверяется со списком: неизвестный ключ должен дать
  // пустую выдачу, а не молча показать весь каталог.
  it("отдаёт категорию сервису как есть, включая неизвестный ключ", async () => {
    expect(await ask({ category: "rain" })).toMatchObject({ category: "rain" });
    expect(await ask({ category: "нет-такой" })).toMatchObject({ category: "нет-такой" });
  });

  it("отбрасывает пустую категорию", async () => {
    expect(await ask({ category: "" })).not.toHaveProperty("category");
  });
});

describe("CatalogController.categories", () => {
  it("отдаёт список сервиса без изменений", async () => {
    const rows = [{ key: "rain", label: "Дождевики", count: 5 }];
    categories.mockResolvedValue(rows);
    await expect(controller.categories()).resolves.toEqual(rows);
  });
});

describe("CatalogController.product — карточка товара", () => {
  it("отдаёт карточку сервиса без изменений", async () => {
    await expect(controller.product("sviter-saharok")).resolves.toEqual(CARD);
    expect(product).toHaveBeenCalledWith("sviter-saharok");
  });

  // Пустая карточка выглядела бы как товар без описания, а не как отсутствие
  // товара: по 404 фронт рисует «Товара нет» и дорогу назад в каталог.
  it("превращает отсутствие товара в 404", async () => {
    product.mockResolvedValue(null);

    await expect(controller.product("нет-такого")).rejects.toMatchObject({ status: 404 });
  });
});
