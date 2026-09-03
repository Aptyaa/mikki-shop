// Полифил метаданных нужен по той же причине, что и в тесте контроллера:
// `@Injectable()` пишет их при загрузке модуля. Контейнер Nest не поднимается —
// сервис создаётся с подставным Prisma.
import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { CatalogService } from "./catalog.service";
import type { PrismaService } from "../prisma/prisma.service";

/** Строка размера товара в том виде, в каком её отдаёт Prisma. */
type SizeRow = {
  size: string;
  quantity: number;
  chestCm: string | null;
  neckCm: string | null;
  backCm: string | null;
};

/** Строка товара в том виде, в каком её отдаёт Prisma. */
type Row = {
  id: string;
  slug: string;
  title: string;
  price: number;
  wasPrice: number | null;
  tag: string | null;
  tagTone: string | null;
  sizes: SizeRow[];
  soldOut: boolean;
  stockNote: string | null;
  createdAt: Date;
  popularity: number;
  category: { key: string; label: string };
  description: string | null;
  composition: string | null;
  care: string | null;
  rating: number | null;
  reviewCount: number;
  photos: string[];
  colors: { name: string; hex: string }[];
};

/** Размер в наличии, с мерками — как их кладёт сид. */
function size(name: string, over: Partial<SizeRow> = {}): SizeRow {
  return { size: name, quantity: 6, chestCm: "34–40", neckCm: "22–26", backCm: "24–28", ...over };
}

function row(over: Partial<Row> = {}): Row {
  return {
    id: "p1",
    slug: "sweater-kosa",
    title: "Свитер «Коса»",
    price: 2490,
    wasPrice: null,
    tag: null,
    tagTone: null,
    sizes: [size("S"), size("M")],
    soldOut: false,
    stockNote: null,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    popularity: 10,
    category: { key: "sweaters", label: "Свитеры" },
    description: null,
    composition: null,
    care: null,
    rating: null,
    reviewCount: 0,
    photos: [],
    colors: [],
    ...over,
  };
}

type Args = Record<string, unknown>;

/**
 * Подставной Prisma. Страница выдачи приходит из `product.findMany`, фасет
 * размеров — из `productSize.findMany` (отдельная таблица, `distinct` по
 * размеру). `count` вызывается с `where` для «подошло под фильтр» и без
 * аргументов для «всего в каталоге».
 */
function makePrisma(options: { rows?: Row[]; facet?: { size: string }[] } = {}) {
  const rows = options.rows ?? [row()];
  const facet = options.facet ?? [{ size: "S" }, { size: "M" }];

  const findMany = vi.fn(async (_args: Args) => rows);
  const findUnique = vi.fn(async (_args: Args) => rows[0] ?? null);
  const count = vi.fn(async (args?: Args) => (args?.where ? 7 : 28));
  const facetFindMany = vi.fn(async (_args: Args) => facet);

  return {
    service: new CatalogService({
      product: { findMany, findUnique, count },
      productSize: { findMany: facetFindMany },
    } as unknown as PrismaService),
    /** Аргументы запроса страницы выдачи. */
    page: () => findMany.mock.calls.at(-1)?.[0] as Args,
    /** Аргументы запроса фасета размеров. */
    facetQuery: () => facetFindMany.mock.calls.at(-1)?.[0] as Args,
    /** Аргументы запроса карточки товара. */
    card: () => findUnique.mock.calls.at(-1)?.[0] as Args,
  };
}

describe("CatalogService.products — постраничная выдача", () => {
  it("возвращает оба счётчика и параметры отданной страницы", async () => {
    const { service } = makePrisma();
    const result = await service.products({ limit: 8, offset: 16 });

    expect(result).toMatchObject({ matched: 7, total: 28, limit: 8, offset: 16 });
  });

  it("переводит limit и offset в take и skip", async () => {
    const { service, page } = makePrisma();
    await service.products({ limit: 12, offset: 24 });

    expect(page()).toMatchObject({ take: 12, skip: 24 });
  });

  it("без limit и offset берёт первую страницу в 8 товаров", async () => {
    const { service, page } = makePrisma();
    await service.products({});

    expect(page()).toMatchObject({ take: 8, skip: 0 });
  });

  // Тай-брейкер по id — то, что чинит главную дырку offset-пагинации: без него
  // товары с одинаковой популярностью встают между страницами в произвольном
  // порядке, и один может приехать дважды, а другой не приехать вовсе.
  it("добивает любую сортировку идентификатором", async () => {
    const { service, page } = makePrisma();

    await service.products({});
    expect(page()).toMatchObject({
      orderBy: [{ popularity: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    });
  });

  it("знает сортировки каталога", async () => {
    const cheap = makePrisma();
    await cheap.service.products({ sort: "cheap" });
    expect(cheap.page()).toMatchObject({ orderBy: [{ price: "asc" }, { id: "asc" }] });

    const fresh = makePrisma();
    await fresh.service.products({ sort: "new" });
    expect(fresh.page()).toMatchObject({ orderBy: [{ createdAt: "desc" }, { id: "asc" }] });
  });
});

describe("CatalogService.products — фильтры", () => {
  it("фильтрует по ключу категории", async () => {
    const { service, page } = makePrisma();
    await service.products({ category: "rain" });

    expect(page().where).toMatchObject({ category: { key: "rain" } });
  });

  // `all` — псевдокатегория экрана «Всё», а не строка в таблице.
  it("не фильтрует по псевдокатегории «all»", async () => {
    const { service, page } = makePrisma();
    await service.products({ category: "all" });

    expect(page().where).not.toHaveProperty("category");
  });

  it("ищет по названию без учёта регистра", async () => {
    const { service, page } = makePrisma();
    await service.products({ q: "дождевик" });

    expect(page().where).toMatchObject({
      title: { contains: "дождевик", mode: "insensitive" },
    });
  });

  // Фасет предлагает только размеры, по которым есть остаток; выдача обязана
  // отвечать тем же, иначе выбор размера в шите даёт товары, которых нет.
  it("фильтрует выдачу по размеру, у которого есть остаток", async () => {
    const { service, page } = makePrisma();
    await service.products({ size: "M" });

    expect(page().where).toMatchObject({
      soldOut: false,
      sizes: { some: { size: "M", quantity: { gt: 0 } } },
    });
  });

  // Без фильтра по размеру распроданные товары из выдачи не выкидываются:
  // в сетке они честно помечены «нет в наличии».
  it("без фильтра по размеру не отсеивает распроданные", async () => {
    const { service, page } = makePrisma();
    await service.products({ category: "rain" });

    expect(page().where).not.toHaveProperty("soldOut");
  });
});

describe("CatalogService.products — фасет размеров", () => {
  // Если считать доступные размеры уже отфильтрованными по размеру, в шите
  // останется единственная кнопка — та, что сама себя и оставила, и снять
  // фильтр станет нечем.
  it("считает доступные размеры до фильтра по размеру, но внутри категории", async () => {
    const { service, facetQuery } = makePrisma();
    await service.products({ category: "rain", size: "M" });

    expect(facetQuery().where).toMatchObject({ product: { category: { key: "rain" } } });
    expect(facetQuery().where).not.toHaveProperty("size");
  });

  it("не считает доступными ни размеры распроданных товаров, ни нулевые остатки", async () => {
    const { service, facetQuery } = makePrisma();
    await service.products({});

    expect(facetQuery().where).toMatchObject({
      quantity: { gt: 0 },
      product: { soldOut: false },
    });
  });

  it("отдаёт всю сетку и доступную часть в порядке сетки", async () => {
    const { service } = makePrisma({ facet: [{ size: "L" }, { size: "XS" }] });
    const result = await service.products({});

    expect(result.sizes).toEqual(["XS", "S", "M", "L", "XL"]);
    expect(result.availableSizes).toEqual(["XS", "L"]);
  });

  it("на пустой выборке оставляет доступные размеры пустыми", async () => {
    const { service } = makePrisma({ rows: [], facet: [] });
    const result = await service.products({});

    expect(result.availableSizes).toEqual([]);
    expect(result.items).toEqual([]);
  });
});

describe("CatalogService.products — карточка товара", () => {
  it("собирает карточку из строки и связанной категории", async () => {
    const { service } = makePrisma({
      rows: [row({ wasPrice: 2990, tag: "Хит", tagTone: "sale", stockNote: "Остался размер S" })],
    });
    const [item] = (await service.products({})).items;

    expect(item).toEqual({
      id: "p1",
      slug: "sweater-kosa",
      category: "sweaters",
      title: "Свитер «Коса»",
      price: 2490,
      was: 2990,
      tag: "Хит",
      tagTone: "sale",
      sizes: ["S", "M"],
      soldOut: false,
      stockNote: "Остался размер S",
    });
  });

  it("не выдумывает необязательные поля, когда их нет в строке", async () => {
    const { service } = makePrisma({ rows: [row()] });
    const [item] = (await service.products({})).items;

    expect(item).not.toHaveProperty("was");
    expect(item).not.toHaveProperty("tag");
    expect(item).not.toHaveProperty("tagTone");
    expect(item).not.toHaveProperty("stockNote");
  });

  // В БД `tagTone` — обычная строка, а на фронте это набор тонов дизайн-системы.
  // Значение не из набора роняло бы вёрстку карточки, поэтому оно отбрасывается.
  it("отбрасывает тон плашки, которого нет в дизайн-системе", async () => {
    const { service } = makePrisma({ rows: [row({ tag: "Хит", tagTone: "кислотный" })] });
    const [item] = (await service.products({})).items;

    expect(item).toMatchObject({ tag: "Хит" });
    expect(item).not.toHaveProperty("tagTone");
  });

  it("отбрасывает размеры вне сетки магазина", async () => {
    const { service } = makePrisma({ rows: [row({ sizes: [size("S"), size("XXL"), size("M")] })] });
    const [item] = (await service.products({})).items;

    expect(item?.sizes).toEqual(["S", "M"]);
  });

  // В базе размер — строка, и `ORDER BY size` дал бы L, M, S, XL, XS.
  it("отдаёт размеры в порядке сетки, а не в порядке строк из базы", async () => {
    const { service } = makePrisma({ rows: [row({ sizes: [size("L"), size("XS"), size("M")] })] });
    const [item] = (await service.products({})).items;

    expect(item?.sizes).toEqual(["XS", "M", "L"]);
  });
});

describe("CatalogService.product — карточка товара", () => {
  it("ищет товар по слагу", async () => {
    const { service, card } = makePrisma();
    await service.product("sweater-kosa");

    expect(card()).toMatchObject({ where: { slug: "sweater-kosa" } });
  });

  it("на неизвестный слаг отдаёт null, а не пустую карточку", async () => {
    const { service } = makePrisma({ rows: [] });

    await expect(service.product("нет-такого")).resolves.toBeNull();
  });

  it("добавляет к плитке всё, что нужно карточке", async () => {
    const { service } = makePrisma({
      rows: [
        row({
          description: "Плотная вязка в две нити.",
          composition: "меринос 70%, акрил 30%",
          care: "Стирка при 30°.",
          rating: 4.8,
          reviewCount: 126,
          colors: [{ name: "Сливочный", hex: "#FBF3E4" }],
        }),
      ],
    });
    const card = await service.product("sweater-kosa");

    expect(card).toMatchObject({
      slug: "sweater-kosa",
      categoryLabel: "Свитеры",
      description: "Плотная вязка в две нити.",
      composition: "меринос 70%, акрил 30%",
      care: "Стирка при 30°.",
      rating: 4.8,
      reviewCount: 126,
      photos: [],
      colors: [{ name: "Сливочный", hex: "#FBF3E4" }],
    });
  });

  it("не выдумывает необязательные поля карточки", async () => {
    const { service } = makePrisma();
    const card = await service.product("sweater-kosa");

    expect(card).not.toHaveProperty("description");
    expect(card).not.toHaveProperty("composition");
    expect(card).not.toHaveProperty("care");
    expect(card).not.toHaveProperty("rating");
    // Отзывов может не быть, но число — не «необязательное поле»: ноль честнее.
    expect(card).toMatchObject({ reviewCount: 0 });
  });

  it("собирает сетку с наличием и мерками в порядке сетки магазина", async () => {
    const { service } = makePrisma({
      rows: [
        row({
          sizes: [
            size("M", { quantity: 0, chestCm: "40–46", neckCm: "26–30", backCm: "28–33" }),
            size("XS", { quantity: 4, chestCm: "28–34", neckCm: "18–22", backCm: "20–24" }),
          ],
        }),
      ],
    });
    const card = await service.product("sweater-kosa");

    expect(card?.sizeRows).toEqual([
      { size: "XS", available: true, chest: "28–34", neck: "18–22", back: "20–24" },
      { size: "M", available: false, chest: "40–46", neck: "26–30", back: "28–33" },
    ]);
  });

  it("не заполняет мерки, которых нет в базе", async () => {
    const { service } = makePrisma({
      rows: [row({ sizes: [size("S", { chestCm: null, neckCm: null, backCm: null })] })] });
    const [first] = (await service.product("sweater-kosa"))?.sizeRows ?? [];

    expect(first).toEqual({ size: "S", available: true });
  });

  // Товар снимают с продажи флагом, а не обнулением остатков по строкам:
  // если сетку не проверять на этот флаг, размеры остались бы кликабельными.
  it("у распроданного товара недоступны все размеры, даже с остатком", async () => {
    const { service } = makePrisma({ rows: [row({ soldOut: true })] });
    const card = await service.product("sweater-kosa");

    expect(card?.sizeRows.every((sizeRow) => !sizeRow.available)).toBe(true);
  });
});

describe("CatalogService.categories", () => {
  it("отдаёт категории по порядку сортировки со счётчиком товаров", async () => {
    const findMany = vi.fn(async (_args: Args) => [
      { key: "sweaters", label: "Свитеры", sortOrder: 1, _count: { products: 9 } },
      { key: "rain", label: "Дождевики", sortOrder: 2, _count: { products: 5 } },
    ]);
    const service = new CatalogService({ category: { findMany } } as unknown as PrismaService);

    await expect(service.categories()).resolves.toEqual([
      { key: "sweaters", label: "Свитеры", count: 9 },
      { key: "rain", label: "Дождевики", count: 5 },
    ]);
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({ orderBy: { sortOrder: "asc" } });
  });
});
