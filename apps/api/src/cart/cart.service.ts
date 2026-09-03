import { Injectable } from "@nestjs/common";
import type {
  CartItemInput,
  CartLineDto,
  CartPreview,
  CatalogSize,
} from "@mikki-shop/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { CART_LINE_MAX } from "./cart.constants";

/** Ключ позиции: один товар в разных размерах и расцветках — разные строки. */
function keyOf(item: { slug: string; size: string; color?: string }): string {
  return `${item.slug} ${item.size} ${item.color ?? ""}`;
}

/** Товар с размерами — то, что читает пересчёт. */
type ProductWithSizes = {
  slug: string;
  title: string;
  price: number;
  wasPrice: number | null;
  soldOut: boolean;
  sizes: { size: string; quantity: number }[];
};

const EMPTY: CartPreview = {
  lines: [],
  gone: [],
  total: 0,
  count: 0,
  hasShortage: false,
};

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Пересчёт корзины.
   *
   * Клиент присылает только слаги, размеры и количества — названия, цены и
   * наличие берутся из базы. Иначе в корзине стояла бы цена, которая лежала в
   * `localStorage` покупателя с прошлой недели и которую можно поправить из
   * девтулзов.
   */
  async preview(items: CartItemInput[]): Promise<CartPreview> {
    if (items.length === 0) return EMPTY;

    const rows = await this.prisma.product.findMany({
      where: { slug: { in: [...new Set(items.map((item) => item.slug))] } },
      include: { sizes: true },
    });
    const bySlug: Map<string, ProductWithSizes> = new Map(rows.map((row) => [row.slug, row]));

    const lines: CartLineDto[] = [];
    const gone: string[] = [];
    // Одну и ту же позицию клиент мог прислать дважды — складываем, а не двоим.
    const seen = new Map<string, CartLineDto>();

    for (const item of items) {
      const row = bySlug.get(item.slug);
      if (!row) {
        if (!gone.includes(item.slug)) gone.push(item.slug);
        continue;
      }

      const existing = seen.get(keyOf(item));
      if (existing) {
        // Лимит позиции применяется и к сумме дублей: три законные строки по
        // десять штук — это всё равно одна позиция, а не тридцать штук.
        existing.quantity = Math.min(existing.quantity + item.quantity, CART_LINE_MAX);
        continue;
      }

      const line: CartLineDto = {
        slug: row.slug,
        title: row.title,
        size: item.size as CatalogSize,
        ...(item.color ? { color: item.color } : {}),
        price: row.price,
        ...(row.wasPrice != null ? { was: row.wasPrice } : {}),
        quantity: item.quantity,
        // Заполняется вторым проходом: остаток общий на размер, и делить его
        // между строками можно только когда известны все.
        maxQuantity: 0,
        lineTotal: 0,
      };
      seen.set(keyOf(item), line);
      lines.push(line);
    }

    this.shareStock(lines, bySlug);

    return {
      lines,
      gone,
      // В сумму идёт только то, что можно купить: иначе итог обещал бы цену за
      // товар, которого на складе нет.
      total: lines.reduce((sum, line) => sum + line.lineTotal, 0),
      count: lines.reduce((sum, line) => sum + Math.min(line.quantity, line.maxQuantity), 0),
      hasShortage: lines.some((line) => line.quantity > line.maxQuantity),
    };
  }

  /**
   * Раздать остаток между строками.
   *
   * Остаток лежит на размере (`ProductSize`) и ничего не знает о расцветке, а
   * строки корзины различаются и по ней. Свитер «Сахарок» размера S в двух
   * расцветках — две строки, но склад у них один. Считай каждую строку
   * отдельно, обе увидели бы полный остаток, корзина позвала бы оформлять, а
   * заказ падал бы всегда: списание-то общее.
   *
   * Делится по порядку строк: первой достаётся столько, сколько она просит,
   * остальным — что осталось. Пропорционально делить незачем: покупателю
   * нужно понять, что чего-то не хватает, а не поровну ли.
   */
  private shareStock(lines: CartLineDto[], bySlug: Map<string, ProductWithSizes>): void {
    const left = new Map<string, number>();

    for (const line of lines) {
      const row = bySlug.get(line.slug);
      const key = `${line.slug} ${line.size}`;
      if (!left.has(key)) {
        const stock = row?.sizes.find((size) => size.size === line.size);
        // Товар, снятый с продажи флагом, недоступен целиком — независимо от
        // того, обнулены ли остатки по строкам размеров.
        left.set(key, row?.soldOut ? 0 : Math.min(stock?.quantity ?? 0, CART_LINE_MAX));
      }

      const budget = left.get(key) ?? 0;
      const maxQuantity = Math.min(budget, CART_LINE_MAX);
      left.set(key, Math.max(0, budget - Math.min(line.quantity, maxQuantity)));

      line.maxQuantity = maxQuantity;
      line.lineTotal = line.price * Math.min(line.quantity, maxQuantity);
    }
  }
}
