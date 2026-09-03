import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import type { CartItemInput, CartPreview, CatalogSize } from "@mikki-shop/shared-types";
import { Public } from "../auth/public.decorator";
import { CATALOG_SIZES } from "../catalog/catalog.constants";
import { CartService } from "./cart.service";
import { CART_LINE_MAX, CART_MAX_ITEMS } from "./cart.constants";

/** Тело запроса до разбора: пришло от клиента, доверия к нему нет. */
interface PreviewBody {
  items?: unknown;
}

function isSize(value: unknown): value is CatalogSize {
  return typeof value === "string" && (CATALOG_SIZES as readonly string[]).includes(value);
}

/**
 * Разбор присланной позиции. Всё, что не похоже на позицию, молча выбрасывается:
 * корзина — не форма, ругаться на неё покупателю бессмысленно, а считать по
 * мусору нельзя.
 */
function toItem(raw: unknown): CartItemInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { slug, size, color, quantity } = raw as Record<string, unknown>;

  if (typeof slug !== "string" || !slug.trim()) return null;
  if (!isSize(size)) return null;

  const parsed = typeof quantity === "number" ? Math.trunc(quantity) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 1) return null;

  return {
    slug: slug.trim().slice(0, 200),
    size,
    ...(typeof color === "string" && color.trim()
      ? { color: color.trim().slice(0, 100) }
      : {}),
    // Верхняя граница здесь, а не только в сервисе: иначе `quantity: 1e9`
    // доехал бы до умножения на цену и дал бы бессмысленный итог.
    quantity: Math.min(parsed, CART_LINE_MAX),
  };
}

/** Корзина. Как и каталог, читается без авторизации: она живёт в браузере. */
@Public()
@Controller("cart")
export class CartController {
  constructor(private readonly cart: CartService) {}

  /**
   * Пересчёт корзины по позициям клиента.
   *
   * POST, а не GET, потому что это не адресуемый ресурс: позиций может быть
   * много, и они не влезают в query осмысленным образом. Ничего не сохраняет —
   * корзина по-прежнему живёт на клиенте.
   */
  @Post("preview")
  // 200, а не 201: запрос ничего не создаёт, он только считает.
  @HttpCode(HttpStatus.OK)
  preview(@Body() body: PreviewBody): Promise<CartPreview> {
    const raw = Array.isArray(body?.items) ? body.items : [];
    const items = raw
      .slice(0, CART_MAX_ITEMS)
      .map(toItem)
      .filter((item): item is CartItemInput => item !== null);

    return this.cart.preview(items);
  }
}
