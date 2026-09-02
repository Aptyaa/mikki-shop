import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CatalogCategory,
  CatalogProduct,
  CatalogQuery,
  CatalogResponse,
  CatalogSize,
  TagTone,
} from "@mikki-shop/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { CATALOG_SIZES, TAG_TONES } from "./catalog.constants";

const SORT_ORDER: Record<string, Prisma.ProductOrderByWithRelationInput[]> = {
  pop: [{ popularity: "desc" }, { createdAt: "desc" }],
  new: [{ createdAt: "desc" }],
  cheap: [{ price: "asc" }],
};

type ProductRow = Prisma.ProductGetPayload<{ include: { category: true } }>;

function isSize(value: string): value is CatalogSize {
  return (CATALOG_SIZES as readonly string[]).includes(value);
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
    sizes: row.sizes.filter(isSize),
    soldOut: row.soldOut,
    ...(row.stockNote ? { stockNote: row.stockNote } : {}),
  };
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

    const where: Prisma.ProductWhereInput = {
      ...scope,
      ...(query.size ? { sizes: { has: query.size } } : {}),
    };

    const [rows, total, scopeRows] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: SORT_ORDER[query.sort ?? "pop"] ?? SORT_ORDER.pop,
      }),
      this.prisma.product.count(),
      this.prisma.product.findMany({ where: scope, select: { sizes: true } }),
    ]);

    const available = new Set(scopeRows.flatMap((row) => row.sizes));

    return {
      items: rows.map(toDto),
      total,
      sizes: [...CATALOG_SIZES],
      availableSizes: CATALOG_SIZES.filter((size) => available.has(size)),
    };
  }
}
