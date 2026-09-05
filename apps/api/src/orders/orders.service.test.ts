import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CartPreview, OrderDraft } from "@mikki-shop/shared-types";
import { OrdersService } from "./orders.service";
import type { CartService } from "../cart/cart.service";
import type { ManagerNotifier } from "./manager-notifier";
import type { PrismaService } from "../prisma/prisma.service";

function preview(over: Partial<CartPreview> = {}): CartPreview {
  const lines = over.lines ?? [
    {
      slug: "bandana-kletka",
      title: "Бандана «Клетка»",
      size: "M" as const,
      color: "Кирпичный",
      price: 590,
      quantity: 2,
      maxQuantity: 6,
      lineTotal: 1180,
    },
  ];
  return {
    lines,
    gone: [],
    total: lines.reduce((sum, line) => sum + line.lineTotal, 0),
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    hasShortage: false,
    ...over,
  };
}

function draft(over: Partial<OrderDraft> = {}): OrderDraft {
  return {
    customerName: "Денис",
    phone: "+79161234567",
    delivery: "courier",
    consent: true,
    address: "Москва, Тверская 1",
    items: [{ slug: "bandana-kletka", size: "M", color: "Кирпичный", quantity: 2 }],
    ...over,
  };
}

/** Ответ Prisma после создания заказа. */
function orderRow(over: Record<string, unknown> = {}) {
  return {
    number: 1,
    status: "NEW",
    createdAt: new Date("2026-09-03T12:00:00Z"),
    customerName: "Денис",
    phone: "+79161234567",
    delivery: "courier",
    consent: true,
    address: "Москва, Тверская 1",
    comment: null,
    total: 1180,
    petName: null,
    items: [
      {
        slug: "bandana-kletka",
        title: "Бандана «Клетка»",
        size: "M",
        color: "Кирпичный",
        price: 590,
        quantity: 2,
      },
    ],
    ...over,
  };
}

type Args = Record<string, unknown>;

let cartPreview: ReturnType<typeof vi.fn>;
let updateMany: ReturnType<typeof vi.fn>;
let create: ReturnType<typeof vi.fn>;
let findMany: ReturnType<typeof vi.fn>;
let orderFindMany: ReturnType<typeof vi.fn>;
let petUpsert: ReturnType<typeof vi.fn>;
let notify: ReturnType<typeof vi.fn>;
let service: OrdersService;

beforeEach(() => {
  cartPreview = vi.fn(async () => preview());
  updateMany = vi.fn(async (_args: Args) => ({ count: 1 }));
  create = vi.fn(async (_args: Args) => orderRow());
  findMany = vi.fn(async (_args: Args) => [{ id: "p1", slug: "bandana-kletka" }]);
  orderFindMany = vi.fn(async (_args: Args) => [orderRow()]);
  petUpsert = vi.fn(async (_args: Args) => ({ id: "pet1" }));
  notify = vi.fn(async () => undefined);

  const tx = {
    productSize: { updateMany },
    product: { findMany },
    order: { create },
  };

  service = new OrdersService(
    {
      $transaction: (run: (client: typeof tx) => unknown) => run(tx),
      order: { findMany: orderFindMany },
      pet: { upsert: petUpsert },
    } as unknown as PrismaService,
    { preview: cartPreview } as unknown as CartService,
    { notify } as unknown as ManagerNotifier,
  );
});

describe("OrdersService.create — состав и суммы", () => {
  // Цены считает тот же сервис, что рисует корзину: подделать их из тела
  // запроса нечем, а расхождение между корзиной и заказом невозможно.
  it("берёт состав и итог из пересчёта корзины, а не из присланного", async () => {
    const order = await service.create("u1", draft());

    expect(cartPreview).toHaveBeenCalledWith(draft().items);
    const args = create.mock.calls[0]?.[0] as { data: { total: number } };
    expect(args.data.total).toBe(1180);
    expect(order.total).toBe(1180);
  });

  it("сохраняет слепок товара, а не ссылку на каталог", async () => {
    await service.create("u1", draft());
    const args = create.mock.calls[0]?.[0] as {
      data: { items: { create: Record<string, unknown>[] } };
    };

    expect(args.data.items.create[0]).toMatchObject({
      slug: "bandana-kletka",
      title: "Бандана «Клетка»",
      size: "M",
      color: "Кирпичный",
      price: 590,
      quantity: 2,
      productId: "p1",
    });
  });

  it("переживает товар, которого уже нет в каталоге, без ссылки", async () => {
    findMany.mockResolvedValue([]);
    await service.create("u1", draft());
    const args = create.mock.calls[0]?.[0] as {
      data: { items: { create: { productId: string | null }[] } };
    };

    expect(args.data.items.create[0]?.productId).toBeNull();
  });

  it("отдаёт заказ с номером и статусом", async () => {
    const order = await service.create("u1", draft());

    expect(order).toMatchObject({ number: 1, status: "NEW" });
    expect(order.lines).toHaveLength(1);
  });
});

describe("OrdersService.create — согласие на обработку данных", () => {
  // 152-ФЗ: у согласия должна быть дата — «когда именно» спрашивают вместе с
  // «давал ли». Флага «да» для ответа субъекту не хватает.
  it("записывает отметку времени согласия, а не флаг", async () => {
    await service.create("u1", draft());
    const args = create.mock.calls[0]?.[0] as { data: { consentAt: Date } };

    expect(args.data.consentAt).toBeInstanceOf(Date);
  });
});

describe("OrdersService.create — остатки", () => {
  it("списывает остаток по каждой позиции", async () => {
    await service.create("u1", draft());
    const args = updateMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };

    expect(args.where).toMatchObject({
      product: { slug: "bandana-kletka" },
      size: "M",
      // Проверка «хватает ли» в `where`, а не отдельным чтением: две вкладки
      // иначе разберут последнюю штуку дважды и уведут остаток в минус.
      quantity: { gte: 2 },
    });
    expect(args.data).toEqual({ quantity: { decrement: 2 } });
  });

  // Два заказа на одни и те же товары в обратном порядке блокировали бы
  // строки крест-накрест и давали дедлок Postgres (40P01).
  it("списывает позиции в одном и том же порядке, как бы их ни прислали", async () => {
    const lines = preview().lines;
    const second = { ...lines[0]!, slug: "sviter-aran", size: "S" as const };
    cartPreview.mockResolvedValue(preview({ lines: [second, lines[0]!] }));

    await service.create("u1", draft());
    const slugs = updateMany.mock.calls.map(
      (call) => (call[0] as { where: { product: { slug: string } } }).where.product.slug,
    );

    expect(slugs).toEqual(["bandana-kletka", "sviter-aran"]);
  });

  it("на проигранной гонке за последней штукой отказывает, а не уводит в минус", async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await expect(service.create("u1", draft())).rejects.toMatchObject({
      status: 409,
      response: { reason: "out-of-stock" },
    });
    expect(create).not.toHaveBeenCalled();
  });

  // Наличие могло измениться, пока покупатель заполнял форму. Обещать ему
  // товар, которого нет, хуже, чем вернуть в корзину.
  it("не оформляет заказ, если в корзине нехватка", async () => {
    cartPreview.mockResolvedValue(preview({ hasShortage: true }));

    await expect(service.create("u1", draft())).rejects.toMatchObject({ status: 409 });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("не оформляет заказ, если товар уехал из каталога", async () => {
    cartPreview.mockResolvedValue(preview({ gone: ["bandana-kletka"] }));

    await expect(service.create("u1", draft())).rejects.toMatchObject({ status: 409 });
  });
});

describe("OrdersService.create — пустая корзина", () => {
  it("не ходит в базу, если позиций нет", async () => {
    await expect(service.create("u1", draft({ items: [] }))).rejects.toMatchObject({
      status: 400,
      response: { reason: "empty-cart" },
    });
    expect(cartPreview).not.toHaveBeenCalled();
  });

  it("отказывает, если от позиций ничего не осталось после пересчёта", async () => {
    cartPreview.mockResolvedValue(preview({ lines: [] }));

    await expect(service.create("u1", draft())).rejects.toMatchObject({
      status: 400,
      response: { reason: "empty-cart" },
    });
  });
});

describe("OrdersService.create — питомец", () => {
  // ARCHITECTURE.md: Pet — отдельная сущность с первого дня. Экрана профиля
  // ещё нет, кличку спрашивают на оформлении, но заводится он сразу.
  it("заводит питомца по кличке и привязывает к заказу", async () => {
    await service.create("u1", draft({ petName: "Микки" }));

    expect(petUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_name: { userId: "u1", name: "Микки" } } }),
    );
    const args = create.mock.calls[0]?.[0] as { data: { petId: string | null; petName: string | null } };
    expect(args.data.petId).toBe("pet1");
    // И слепком в самом заказе — переименование питомца его не тронет.
    expect(args.data.petName).toBe("Микки");
  });

  it("второй заказ на ту же кличку не плодит питомцев", async () => {
    await service.create("u1", draft({ petName: "Микки" }));
    await service.create("u1", draft({ petName: "Микки" }));

    const [first, second] = petUpsert.mock.calls.map((call) => call[0] as { update: unknown });
    expect(first?.update).toEqual({});
    expect(second?.update).toEqual({});
  });

  it("без клички заказ оформляется и питомца не заводит", async () => {
    await service.create("u1", draft());

    expect(petUpsert).not.toHaveBeenCalled();
    const args = create.mock.calls[0]?.[0] as { data: { petId: string | null } };
    expect(args.data.petId).toBeNull();
  });
});

describe("OrdersService.create — заявка менеджеру", () => {
  it("отправляет заявку после того, как заказ записан", async () => {
    const order = await service.create("u1", draft());

    expect(notify).toHaveBeenCalledWith(order);
  });

  // Заказ уже записан: молчащий бот — повод посмотреть в лог, а не потерять
  // покупателя.
  it("не роняет заказ, если заявка не ушла", async () => {
    notify.mockRejectedValue(new Error("telegram down"));

    await expect(service.create("u1", draft())).resolves.toMatchObject({ number: 1 });
  });
});

describe("OrdersService.list", () => {
  it("отдаёт заказы покупателя, свежие сверху", async () => {
    await service.list("u1");
    const args = orderFindMany.mock.calls[0]?.[0] as Args;

    expect(args).toMatchObject({
      where: { userId: "u1" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("собирает строки со слепком цены", async () => {
    const [order] = await service.list("u1");

    expect(order?.lines[0]).toEqual({
      slug: "bandana-kletka",
      title: "Бандана «Клетка»",
      size: "M",
      color: "Кирпичный",
      price: 590,
      quantity: 2,
    });
  });

  it("не выдумывает необязательных полей", async () => {
    orderFindMany.mockResolvedValue([orderRow({ address: null, comment: null, petName: null })]);
    const [order] = await service.list("u1");

    expect(order).not.toHaveProperty("address");
    expect(order).not.toHaveProperty("comment");
    expect(order).not.toHaveProperty("petName");
  });

  /**
   * Кличка читается из самого заказа, а не через связь с питомцем: в профиле
   * её можно переименовать и удалить, а заказ обязан показывать то, что было
   * при оформлении.
   */
  it("отдаёт кличку питомца слепком из самого заказа", async () => {
    orderFindMany.mockResolvedValue([orderRow({ petName: "Микки" })]);
    const [order] = await service.list("u1");

    expect(order?.petName).toBe("Микки");
    // Связь для этого не запрашивается вовсе.
    const args = orderFindMany.mock.calls[0]?.[0] as { include?: Record<string, unknown> };
    expect(args.include).not.toHaveProperty("pet");
  });
});
