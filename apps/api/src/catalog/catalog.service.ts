import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CatalogCategory,
  CatalogProduct,
  CatalogQuery,
  CatalogResponse,
  CatalogSize,
  ProductDetail,
  ProductSizeRow,
  TagTone,
} from "@mikki-shop/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { CATALOG_PAGE_SIZE, CATALOG_SIZES, TAG_TONES } from "./catalog.constants";

const SORT_ORDER: Record<string, Prisma.ProductOrderByWithRelationInput[]> = {
  pop: [{ popularity: "desc" }, { createdAt: "desc" }],
  new: [{ createdAt: "desc" }],
  cheap: [{ price: "asc" }],
};

/** Что нужно, чтобы собрать плитку каталога. */
const TILE = { category: true, sizes: true } as const;

/** Плюс то, что нужно только карточке товара. */
const CARD = {
  ...TILE,
  colors: { orderBy: { sortOrder: "asc" } },
} as const satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof TILE }>;
type ProductCardRow = Prisma.ProductGetPayload<{ include: typeof CARD }>;

function isSize(value: string): value is CatalogSize {
  return (CATALOG_SIZES as readonly string[]).includes(value);
}

/**
 * Размеры товара в порядке сетки магазина.
 *
 * Порядок задаётся здесь, а не в `ORDER BY`: в базе размер — строка, и
 * сортировка по ней дала бы L, M, S, XL, XS. Заодно отсеиваются размеры,
 * которых в сетке магазина нет.
 */
function gridSizes(rows: { size: string }[]): CatalogSize[] {
  const present = new Set(rows.map((row) => row.size));
  return CATALOG_SIZES.filter((size) => present.has(size));
}

function toDto(row: ProductRow): CatalogProduct {
  return {
    id: row.id,
    slug: row.slug,
    category: row.category.key,
    title: row.title,
    price: row.price,
    ...(row.wasPrice != null ? { was: row.wasPrice } : {}),
    ...(row.tag ? { tag: row.tag } : {}),
    ...(row.tagTone && (TAG_TONES as readonly string[]).includes(row.tagTone)
      ? { tagTone: row.tagTone as TagTone }
      : {}),
    sizes: gridSizes(row.sizes),
    soldOut: row.soldOut,
    ...(row.stockNote ? { stockNote: row.stockNote } : {}),
  };
}

/** Сетка товара с наличием и мерками — то, чем карточка отличается от плитки. */
function toSizeRows(row: ProductCardRow): ProductSizeRow[] {
  return CATALOG_SIZES.flatMap((size) => {
    const found = row.sizes.find((candidate) => candidate.size === size);
    if (!found) return [];
    return [
      {
        size,
        // Товар, снятый с продажи целиком, не оставляет доступных размеров,
        // даже если остатки по строкам не обнулены.
        available: !row.soldOut && found.quantity > 0,
        ...(found.chestCm ? { chest: found.chestCm } : {}),
        ...(found.neckCm ? { neck: found.neckCm } : {}),
        ...(found.backCm ? { back: found.backCm } : {}),
      },
    ];
  });
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async categories(): Promise<CatalogCategory[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { products: true } } },
    });

    return rows.map((row) => ({
      key: row.key,
      label: row.label,
      count: row._count.products,
    }));
  }

  async products(query: CatalogQuery): Promise<CatalogResponse> {
    // Фильтр по категории и поиску сужает выдачу; фильтр по размеру — нет:
    // он применяется поверх, но набор доступных размеров считается до него,
    // иначе в шите остался бы выбран единственный размер, который сам себя и оставил.
    const scope: Prisma.ProductWhereInput = {
      ...(query.category && query.category !== "all"
        ? { category: { key: query.category } }
        : {}),
      ...(query.q ? { title: { contains: query.q, mode: "insensitive" } } : {}),
    };

    // Размер считается подходящим, только если по нему есть что отгрузить.
    // Условия те же, что у фасета ниже, включая `soldOut`: фасет предлагает
    // размер, потому что где-то он есть, — и выдача по нему не должна
    // приносить товар, снятый с продажи флагом при ненулевых остатках.
    const where: Prisma.ProductWhereInput = {
      ...scope,
      ...(query.size
        ? { soldOut: false, sizes: { some: { size: query.size, quantity: { gt: 0 } } } }
        : {}),
    };

    const limit = query.limit ?? CATALOG_PAGE_SIZE;
    const offset = query.offset ?? 0;

    // Сортировка добита `id`: без него у товаров с одинаковой популярностью
    // порядок между страницами не определён, и один и тот же товар может
    // приехать дважды, а другой — не приехать вовсе.
    const orderBy = [...(SORT_ORDER[query.sort ?? "pop"] ?? SORT_ORDER.pop), { id: "asc" as const }];

    const [rows, matched, total, facet] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: TILE,
        orderBy,
        take: limit,
        skip: offset,
      }),
      this.prisma.product.count({ where }),
      this.prisma.product.count(),
      // Размеры распроданных товаров и нулевые остатки не считаются доступными:
      // иначе фильтр предлагает размер, по которому нечего купить.
      this.prisma.productSize.findMany({
        where: { quantity: { gt: 0 }, product: { ...scope, soldOut: false } },
        select: { size: true },
        distinct: ["size"],
      }),
    ]);

    return {
      items: rows.map(toDto),
      matched,
      total,
      offset,
      limit,
      sizes: [...CATALOG_SIZES],
      availableSizes: gridSizes(facet),
    };
  }

  /** Карточка товара по слагу. `null` — товара нет, контроллер превратит это в 404. */
  async product(slug: string): Promise<ProductDetail | null> {
    const row = await this.prisma.product.findUnique({ where: { slug }, include: CARD });
    if (!row) return null;

    return {
      ...toDto(row),
      categoryLabel: row.category.label,
      ...(row.description ? { description: row.description } : {}),
      ...(row.composition ? { composition: row.composition } : {}),
      ...(row.care ? { care: row.care } : {}),
      ...(row.rating != null ? { rating: row.rating } : {}),
      reviewCount: row.reviewCount,
      photos: row.photos,
      colors: row.colors.map((color) => ({ name: color.name, hex: color.hex })),
      sizeRows: toSizeRows(row),
    };
  }
}
