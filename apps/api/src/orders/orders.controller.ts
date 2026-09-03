import { BadRequestException, Body, Controller, Get, Post } from "@nestjs/common";
import type {
  CartItemInput,
  CatalogSize,
  DeliveryMethod,
  Order,
  OrderDraft,
} from "@mikki-shop/shared-types";
import { CATALOG_SIZES } from "../catalog/catalog.constants";
import { CART_LINE_MAX, CART_MAX_ITEMS } from "../cart/cart.constants";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtPayload } from "../auth/auth.service";
import {
  DELIVERY_METHODS,
  DELIVERY_NEEDS_ADDRESS,
  MAX_ADDRESS,
  MAX_COMMENT,
  MAX_NAME,
  MAX_PET_NAME,
  MAX_PHONE,
} from "./orders.constants";
import { OrdersService } from "./orders.service";

/** Тело запроса до разбора: пришло от клиента, доверия к нему нет. */
interface CreateBody {
  customerName?: unknown;
  phone?: unknown;
  delivery?: unknown;
  address?: unknown;
  comment?: unknown;
  petName?: unknown;
  consent?: unknown;
  items?: unknown;
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function isSize(value: unknown): value is CatalogSize {
  return typeof value === "string" && (CATALOG_SIZES as readonly string[]).includes(value);
}

/** Позиция корзины. Разбирается так же, как в `/cart/preview`. */
function toItem(raw: unknown): CartItemInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { slug, size, color, quantity } = raw as Record<string, unknown>;

  const cleanSlug = text(slug, 200);
  if (!cleanSlug || !isSize(size)) return null;

  const parsed = typeof quantity === "number" ? Math.trunc(quantity) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 1) return null;

  const cleanColor = text(color, 100);
  return {
    slug: cleanSlug,
    size,
    ...(cleanColor ? { color: cleanColor } : {}),
    quantity: Math.min(parsed, CART_LINE_MAX),
  };
}

/**
 * Телефон — единственное поле, которое покупатель вводит и без которого
 * заявка бесполезна: менеджеру надо звонить. Проверка мягкая, только на
 * «похоже на телефон»: строгая маска ломается о международные номера, а
 * человека, ошибшегося цифрой, всё равно спасёт только звонок.
 */
function isPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

@Controller("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /**
   * Оформление заказа. Закрыто: заказ надо к кому-то привязать, а «кто это»
   * знает только Telegram.
   */
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateBody): Promise<Order> {
    return this.orders.create(user.sub, toDraft(body));
  }

  /** Заказы покупателя. */
  @Get()
  list(@CurrentUser() user: JwtPayload): Promise<Order[]> {
    return this.orders.list(user.sub);
  }
}

/**
 * Разбор формы.
 *
 * В отличие от корзины, здесь на плохих данных отвечаем ошибкой, а не молча
 * выбрасываем: это форма, и покупателю надо знать, что именно поправить.
 */
export function toDraft(body: CreateBody): OrderDraft {
  const customerName = text(body?.customerName, MAX_NAME);
  if (!customerName) {
    throw new BadRequestException({ reason: "invalid", message: "Укажите имя" });
  }

  const phone = text(body?.phone, MAX_PHONE);
  if (!phone || !isPhone(phone)) {
    throw new BadRequestException({ reason: "invalid", message: "Проверьте номер телефона" });
  }

  const delivery = body?.delivery;
  if (
    typeof delivery !== "string" ||
    !(DELIVERY_METHODS as readonly string[]).includes(delivery)
  ) {
    throw new BadRequestException({ reason: "invalid", message: "Выберите способ получения" });
  }
  const method = delivery as DeliveryMethod;

  const address = text(body?.address, MAX_ADDRESS);
  if (!address && (DELIVERY_NEEDS_ADDRESS as readonly string[]).includes(method)) {
    throw new BadRequestException({ reason: "invalid", message: "Укажите адрес доставки" });
  }

  // Согласие на обработку ПД (152-ФЗ). Проверяется на сервере, а не только
  // галочкой в форме: без него персональные данные хранить нельзя, а запрос
  // приходит не обязательно из нашего интерфейса.
  if (body?.consent !== true) {
    throw new BadRequestException({
      reason: "invalid",
      message: "Нужно согласие на обработку персональных данных",
    });
  }

  const raw = Array.isArray(body?.items) ? body.items : [];
  const items = raw
    .slice(0, CART_MAX_ITEMS)
    .map(toItem)
    .filter((item): item is CartItemInput => item !== null);
  if (items.length === 0) {
    throw new BadRequestException({ reason: "empty-cart", message: "Корзина пуста" });
  }

  const comment = text(body?.comment, MAX_COMMENT);
  const petName = text(body?.petName, MAX_PET_NAME);

  return {
    customerName,
    phone,
    delivery: method,
    consent: true,
    // Адрес самовывозу не нужен: если его прислали, он всё равно ни к чему.
    ...(address && (DELIVERY_NEEDS_ADDRESS as readonly string[]).includes(method)
      ? { address }
      : {}),
    ...(comment ? { comment } : {}),
    ...(petName ? { petName } : {}),
    items,
  };
}
