// Полифил метаданных нужен по той же причине, что и в тестах каталога:
// `@Injectable()` пишет их при загрузке модуля. Контейнер Nest не поднимается.
import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { CartService } from "./cart.service";
import type { PrismaService } from "../prisma/prisma.service";

type Row = {
  slug: string;
  title: string;
  price: number;
  wasPrice: number | null;
  soldOut: boolean;
  sizes: { size: string; quantity: number }[];
};

function row(over: Partial<Row> = {}): Row {
  return {
    slug: "sviter-saharok",
    title: "Вязаный свитер «Сахарок»",
    price: 1490,
    wasPrice: null,
    soldOut: false,
    sizes: [
      { size: "S", quantity: 3 },
      { size: "M", quantity: 0 },
    ],
    ...over,
  };
}

function makeService(rows: Row[] = [row()]) {
  const findMany = vi.fn(async (_args: Record<string, unknown>) => rows);
  return {
    service: new CartService({ product: { findMany } } as unknown as PrismaService),
    query: () => findMany.mock.calls.at(-1)?.[0] as Record<string, unknown>,
  };
}

describe("CartService.preview — пересчёт", () => {
  it("на пустой корзине не ходит в базу", async () => {
    const { service, query } = makeService();

    await expect(service.preview([])).resolves.toEqual({
      lines: [],
      gone: [],
      total: 0,
      count: 0,
      hasShortage: false,
    });
    expect(query()).toBeUndefined();
  });

  // Цена и название берутся из базы: в корзине клиента лежат только слаг,
  // размер и количество, и подделать цену из девтулзов нечем.
  it("берёт название и цену из каталога, а не из присланного", async () => {
    const { service } = makeService([row({ wasPrice: 2190 })]);
    const { lines, total } = await service.preview([
      { slug: "sviter-saharok", size: "S", quantity: 2 },
    ]);

    expect(lines[0]).toMatchObject({
      title: "Вязаный свитер «Сахарок»",
      price: 1490,
      was: 2190,
      quantity: 2,
      lineTotal: 2980,
    });
    expect(total).toBe(2980);
  });

  it("спрашивает базу об уникальных слагах один раз", async () => {
    const { service, query } = makeService();
    await service.preview([
      { slug: "sviter-saharok", size: "S", quantity: 1 },
      { slug: "sviter-saharok", size: "M", quantity: 1 },
    ]);

    expect(query()).toMatchObject({ where: { slug: { in: ["sviter-saharok"] } } });
  });

  it("складывает одинаковые позиции в одну строку", async () => {
    const { service } = makeService();
    const { lines, total } = await service.preview([
      { slug: "sviter-saharok", size: "S", quantity: 1 },
      { slug: "sviter-saharok", size: "S", quantity: 2 },
    ]);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ quantity: 3, lineTotal: 4470 });
    expect(total).toBe(4470);
  });

  // Иначе три законные строки по десять штук дали бы одну строку на тридцать —
  // мимо лимита позиции, который контроллер проверял для каждой по отдельности.
  it("режет лимитом позиции и сумму дублей", async () => {
    const { service } = makeService([row({ sizes: [{ size: "S", quantity: 100 }] })]);
    const { lines } = await service.preview([
      { slug: "sviter-saharok", size: "S", quantity: 10 },
      { slug: "sviter-saharok", size: "S", quantity: 10 },
      { slug: "sviter-saharok", size: "S", quantity: 10 },
    ]);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.quantity).toBe(10);
    expect(lines[0]?.lineTotal).toBe(14900);
  });

  // Размер и расцветка — часть позиции: один товар в двух размерах это две
  // строки, иначе покупатель не сможет убрать только один из них.
  it("разделяет позиции по размеру и расцветке", async () => {
    const { service } = makeService();
    const { lines } = await service.preview([
      { slug: "sviter-saharok", size: "S", color: "Сливочный", quantity: 1 },
      { slug: "sviter-saharok", size: "S", color: "Карамель", quantity: 1 },
    ]);

    expect(lines).toHaveLength(2);
    expect(lines.map((line) => line.color)).toEqual(["Сливочный", "Карамель"]);
  });
});

describe("CartService.preview — наличие", () => {
  it("ограничивает доступное количество остатком", async () => {
    const { service } = makeService([row({ sizes: [{ size: "S", quantity: 1 }] })]);
    const { lines, total, count, hasShortage } = await service.preview([
      { slug: "sviter-saharok", size: "S", quantity: 3 },
    ]);

    expect(lines[0]).toMatchObject({ quantity: 3, maxQuantity: 1 });
    // В сумму идёт только то, что можно купить, — иначе итог обещал бы цену
    // за товар, которого на складе нет.
    expect(total).toBe(1490);
    expect(count).toBe(1);
    expect(hasShortage).toBe(true);
  });

  it("режет доступное количество лимитом позиции", async () => {
    const { service } = makeService([row({ sizes: [{ size: "S", quantity: 500 }] })]);
    const { lines } = await service.preview([
      { slug: "sviter-saharok", size: "S", quantity: 10 },
    ]);

    // Точный остаток наружу не отдаётся: покупателю нужно знать не «на складе
    // 500», а сколько он может взять.
    expect(lines[0]?.maxQuantity).toBe(10);
  });

  it("у размера без остатка ничего нельзя взять", async () => {
    const { service } = makeService();
    const { lines, total, count } = await service.preview([
      { slug: "sviter-saharok", size: "M", quantity: 2 },
    ]);

    expect(lines[0]).toMatchObject({ maxQuantity: 0, lineTotal: 0 });
    expect(total).toBe(0);
    expect(count).toBe(0);
  });

  it("у размера, которого у товара нет вовсе, тоже", async () => {
    const { service } = makeService();
    const { lines } = await service.preview([
      { slug: "sviter-saharok", size: "XL", quantity: 1 },
    ]);

    expect(lines[0]?.maxQuantity).toBe(0);
  });

  // Товар снимают с продажи флагом, а не обнулением остатков по строкам.
  it("у распроданного товара недоступно ничего, даже с остатком", async () => {
    const { service } = makeService([row({ soldOut: true })]);
    const { lines, total } = await service.preview([
      { slug: "sviter-saharok", size: "S", quantity: 1 },
    ]);

    expect(lines[0]?.maxQuantity).toBe(0);
    expect(total).toBe(0);
  });

  it("не считает нехваткой корзину, которая целиком есть в наличии", async () => {
    const { service } = makeService();
    const { hasShortage } = await service.preview([
      { slug: "sviter-saharok", size: "S", quantity: 3 },
    ]);

    expect(hasShortage).toBe(false);
  });
});

describe("CartService.preview — товар уехал из каталога", () => {
  it("называет слаги, которых больше нет, и не строит по ним строк", async () => {
    const { service } = makeService();
    const { lines, gone } = await service.preview([
      { slug: "sviter-saharok", size: "S", quantity: 1 },
      { slug: "net-takogo", size: "S", quantity: 1 },
    ]);

    expect(gone).toEqual(["net-takogo"]);
    expect(lines).toHaveLength(1);
  });

  it("не повторяет один и тот же пропавший слаг", async () => {
    const { service } = makeService([]);
    const { gone } = await service.preview([
      { slug: "net-takogo", size: "S", quantity: 1 },
      { slug: "net-takogo", size: "M", quantity: 1 },
    ]);

    expect(gone).toEqual(["net-takogo"]);
  });
});
