// Полифил метаданных нужен по той же причине, что и в тесте контроллера:
// `@Injectable()` пишет их при загрузке модуля. Контейнер Nest не поднимается —
// сервис создаётся с подставным Prisma.
import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { CatalogService } from "./catalog.service";
import type { PrismaService } from "../prisma/prisma.service";

/** Строка товара в том виде, в каком её отдаёт Prisma. */
type Row = {
  id: string;
  slug: string;
  title: string;
  price: number;
  wasPrice: number | null;
  tag: string | null;
  tagTone: string | null;
  sizes: string[];
  soldOut: boolean;
  stockNote: string | null;
  createdAt: Date;
  popularity: number;
  category: { key: string };
};

function row(over: Partial<Row> = {}): Row {
  return {
    id: "p1",
    slug: "sweater-kosa",
    title: "Свитер «Коса»",
    price: 2490,
    wasPrice: null,
    tag: null,
    tagTone: null,
    sizes: ["S", "M"],
    soldOut: false,
    stockNote: null,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    popularity: 10,
    category: { key: "sweaters" },
    ...over,
  };
}

type Args = Record<string, unknown>;

/**
 * Подставной Prisma. Сервис в одном `Promise.all` делает два `findMany`:
 * страницу выдачи (с `include`) и фасет размеров (с `select`) — их и
 * различаем. `count` вызывается с `where` для «подошло под фильтр» и без
 * аргументов для «всего в каталоге».
 */
function makePrisma(options: { rows?: Row[]; facet?: { sizes: string[] }[] } = {}) {
  const rows = options.rows ?? [row()];
  const facet = options.facet ?? [{ sizes: ["S", "M"] }];

  const findMany = vi.fn(async (args: Args) => (args.select ? facet : rows));
  const count = vi.fn(async (args?: Args) => (args?.where ? 7 : 28));

  return {
    service: new CatalogService({ product: { findMany, count } } as unknown as PrismaService),
    /** Аргументы запроса страницы выдачи. */
    page: () => findMany.mock.calls.find((call) => !call[0].select)?.[0] as Args,
    /** Аргументы запроса фасета размеров. */
    facetQuery: () => findMany.mock.calls.find((call) => call[0].select)?.[0] as Args,
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

  it("фильтрует выдачу по размеру", async () => {
    const { service, page } = makePrisma();
    await service.products({ size: "M" });

    expect(page().where).toMatchObject({ sizes: { has: "M" } });
  });
});

describe("CatalogService.products — фасет размеров", () => {
  // Если считать доступные размеры уже отфильтрованными по размеру, в шите
  // останется единственная кнопка — та, что сама себя и оставила, и снять
  // фильтр станет нечем.
  it("считает доступные размеры до фильтра по размеру, но внутри категории", async () => {
    const { service, facetQuery } = makePrisma();
    await service.products({ category: "rain", size: "M" });

    expect(facetQuery().where).toMatchObject({ category: { key: "rain" } });
    expect(facetQuery().where).not.toHaveProperty("sizes");
  });

  it("не считает доступными размеры распроданных товаров", async () => {
    const { service, facetQuery } = makePrisma();
    await service.products({});

    expect(facetQuery().where).toMatchObject({ soldOut: false });
  });

  it("отдаёт всю сетку и доступную часть в порядке сетки", async () => {
    const { service } = makePrisma({ facet: [{ sizes: ["L"] }, { sizes: ["XS", "L"] }] });
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
    const { service } = makePrisma({ rows: [row({ sizes: ["S", "XXL", "M"] })] });
    const [item] = (await service.products({})).items;

    expect(item?.sizes).toEqual(["S", "M"]);
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
