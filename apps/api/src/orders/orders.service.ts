import { BadRequestException, ConflictException, Injectable, Logger } from "@nestjs/common";
import type {
  CatalogSize,
  DeliveryMethod,
  Order,
  OrderDraft,
  OrderLine,
  OrderStatus,
} from "@mikki-shop/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { CartService } from "../cart/cart.service";
import { ManagerNotifier } from "./manager-notifier";

/** Строка заказа в том виде, в каком её отдаёт Prisma. */
type ItemRow = {
  slug: string;
  title: string;
  size: string;
  color: string | null;
  price: number;
  quantity: number;
};

type OrderRow = {
  number: number;
  status: string;
  createdAt: Date;
  customerName: string;
  phone: string;
  delivery: string;
  address: string | null;
  comment: string | null;
  total: number;
  pet: { name: string } | null;
  items: ItemRow[];
};

function toLine(row: ItemRow): OrderLine {
  return {
    slug: row.slug,
    title: row.title,
    size: row.size as CatalogSize,
    ...(row.color ? { color: row.color } : {}),
    price: row.price,
    quantity: row.quantity,
  };
}

function toOrder(row: OrderRow): Order {
  return {
    number: row.number,
    status: row.status as OrderStatus,
    createdAt: row.createdAt.toISOString(),
    customerName: row.customerName,
    phone: row.phone,
    delivery: row.delivery as DeliveryMethod,
    ...(row.address ? { address: row.address } : {}),
    ...(row.comment ? { comment: row.comment } : {}),
    ...(row.pet ? { petName: row.pet.name } : {}),
    total: row.total,
    lines: row.items.map(toLine),
  };
}

/** Что вернуть покупателю, включая причину отказа. */
const INCLUDE = { items: true, pet: { select: { name: true } } } as const;

@Injectable()
export class OrdersService {
  private readonly log = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly notifier: ManagerNotifier,
  ) {}

  /**
   * Оформление заказа.
   *
   * Состав и суммы считает `CartService` — тот же, что рисует корзину: цены
   * берутся из каталога, а не из того, что прислал клиент. Списание остатков
   * и создание заказа идут одной транзакцией, иначе две вкладки разберут
   * последнюю штуку дважды.
   */
  async create(userId: string, draft: OrderDraft): Promise<Order> {
    if (draft.items.length === 0) {
      throw new BadRequestException({ reason: "empty-cart", message: "Корзина пуста" });
    }

    const preview = await this.cart.preview(draft.items);
    if (preview.lines.length === 0) {
      throw new BadRequestException({ reason: "empty-cart", message: "Корзина пуста" });
    }
    // Наличие могло измениться, пока покупатель заполнял форму. Обещать ему
    // товар, которого нет, хуже, чем вернуть в корзину и показать, чего не
    // хватает.
    if (preview.hasShortage || preview.gone.length > 0) {
      throw new ConflictException({
        reason: "out-of-stock",
        message: "Часть товаров разобрали, пока вы оформляли заказ",
      });
    }

    const petId = draft.petName ? await this.petId(userId, draft.petName) : null;

    // Порядок списания — всегда один и тот же, а не тот, в котором позиции
    // лежали в корзине: два заказа на одни и те же товары в обратном порядке
    // иначе блокируют строки крест-накрест и дают дедлок Postgres (40P01).
    const lines = [...preview.lines].sort((a, b) =>
      a.slug === b.slug ? a.size.localeCompare(b.size) : a.slug.localeCompare(b.slug),
    );

    const created = await this.prisma.$transaction(async (tx) => {
      // Остатки списываются условным update: `updateMany` с проверкой
      // «хватает ли» в `where` не даст уйти в минус, даже если два заказа
      // добрались до последней штуки одновременно.
      for (const line of lines) {
        const changed = await tx.productSize.updateMany({
          where: {
            product: { slug: line.slug },
            size: line.size,
            quantity: { gte: line.quantity },
          },
          data: { quantity: { decrement: line.quantity } },
        });
        if (changed.count === 0) {
          throw new ConflictException({
            reason: "out-of-stock",
            message: "Часть товаров разобрали, пока вы оформляли заказ",
          });
        }
      }

      const products = await tx.product.findMany({
        where: { slug: { in: lines.map((line) => line.slug) } },
        select: { id: true, slug: true },
      });
      const idBySlug = new Map(products.map((product) => [product.slug, product.id]));

      return tx.order.create({
        data: {
          userId,
          petId,
          customerName: draft.customerName,
          phone: draft.phone,
          delivery: draft.delivery,
          address: draft.address ?? null,
          comment: draft.comment ?? null,
          // 152-ФЗ: согласие фиксируется отметкой времени, а не флагом — на
          // запрос субъекта надо ответить, когда именно оно было дано.
          consentAt: new Date(),
          total: preview.total,
          items: {
            create: lines.map((line) => ({
              productId: idBySlug.get(line.slug) ?? null,
              slug: line.slug,
              title: line.title,
              size: line.size,
              color: line.color ?? null,
              price: line.price,
              quantity: line.quantity,
            })),
          },
        },
        include: INCLUDE,
      });
    });

    const order = toOrder(created);

    // Не в транзакции и без `await` на результат: заказ уже записан, и
    // молчащий бот — повод посмотреть в лог, а не потерять покупателя.
    // `catch` обязателен: под Node 22 необработанный rejection роняет процесс.
    void this.notifier
      .notify(order)
      .catch((error: unknown) =>
        this.log.error(`Заявка ${order.number} не ушла менеджеру: ${String(error)}`),
      );

    return order;
  }

  /** Заказы покупателя, свежие сверху. */
  async list(userId: string): Promise<Order[]> {
    const rows = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: INCLUDE,
    });
    return rows.map(toOrder);
  }

  /**
   * Питомец по кличке: заводится при первом заказе, дальше переиспользуется.
   *
   * Экрана профиля питомца ещё нет, кличку спрашивают на оформлении — но
   * сущность заводится сразу, как требует `ARCHITECTURE.md`.
   */
  private async petId(userId: string, name: string): Promise<string> {
    const pet = await this.prisma.pet.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name },
      update: {},
      select: { id: true },
    });
    return pet.id;
  }
}
