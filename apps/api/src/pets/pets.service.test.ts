import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { MAX_PETS } from "./pets.constants";
import { PetsService, type PetInput } from "./pets.service";

type Args = Record<string, unknown>;

function row(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "pet1",
    name: "Микки",
    breed: "Мальтипу",
    size: "S",
    chestCm: 38,
    neckCm: 24,
    backCm: 30,
    ...over,
  };
}

/** Ошибка уникальности в том виде, в каком её бросает Prisma. */
function duplicate(): Error & { code: string } {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
}

let findMany: ReturnType<typeof vi.fn>;
let findFirst: ReturnType<typeof vi.fn>;
let count: ReturnType<typeof vi.fn>;
let create: ReturnType<typeof vi.fn>;
let updateMany: ReturnType<typeof vi.fn>;
let deleteMany: ReturnType<typeof vi.fn>;
let service: PetsService;

const draft = (over: Partial<PetInput> = {}): PetInput => ({ name: "Микки", ...over });

beforeEach(() => {
  findMany = vi.fn(async (_args: Args) => [row()]);
  findFirst = vi.fn(async (_args: Args) => row());
  count = vi.fn(async (_args: Args) => 0);
  create = vi.fn(async (_args: Args) => row());
  updateMany = vi.fn(async (_args: Args) => ({ count: 1 }));
  deleteMany = vi.fn(async (_args: Args) => ({ count: 1 }));

  service = new PetsService({
    pet: { findMany, findFirst, count, create, updateMany, deleteMany },
  } as unknown as PrismaService);
});

describe("PetsService.list", () => {
  it("отдаёт только питомцев этого покупателя", async () => {
    await service.list("u1");

    const args = findMany.mock.calls[0]?.[0] as { where: { userId: string } };
    expect(args.where.userId).toBe("u1");
  });

  // Ноль сантиметров — не «мерку не сняли», а невозможная собака: на экране
  // эти два состояния выглядят по-разному, значит и в ответе должны.
  it("не выдумывает незаполненных полей", async () => {
    findMany.mockResolvedValue([
      row({ breed: null, size: null, chestCm: null, neckCm: null, backCm: null }),
    ]);

    const [pet] = await service.list("u1");

    expect(pet).toEqual({ id: "pet1", name: "Микки" });
  });

  it("отдаёт заполненную карточку целиком", async () => {
    const [pet] = await service.list("u1");

    expect(pet).toEqual({
      id: "pet1",
      name: "Микки",
      breed: "Мальтипу",
      size: "S",
      chestCm: 38,
      neckCm: 24,
      backCm: 30,
    });
  });
});

describe("PetsService.create", () => {
  it("заводит питомца на текущего покупателя", async () => {
    await service.create("u1", draft());

    const args = create.mock.calls[0]?.[0] as { data: { userId: string; name: string } };
    expect(args.data.userId).toBe("u1");
    expect(args.data.name).toBe("Микки");
  });

  // Незаполненное поле пишется `null`, а не пропускается: иначе стереть
  // однажды заполненную породу было бы нечем.
  it("пустые поля пишет null, а не пропускает", async () => {
    await service.create("u1", draft());

    const args = create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(args.data.breed).toBeNull();
    expect(args.data.chestCm).toBeNull();
  });

  it("на совпадение клички отвечает отдельной причиной", async () => {
    create.mockRejectedValue(duplicate());

    await expect(service.create("u1", draft())).rejects.toMatchObject({
      response: { reason: "duplicate-name" },
    });
  });

  it("не даёт завести больше лимита", async () => {
    count.mockResolvedValue(MAX_PETS);

    await expect(service.create("u1", draft())).rejects.toMatchObject({
      response: { reason: "invalid" },
    });
    expect(create).not.toHaveBeenCalled();
  });

  // Чужие ошибки Prisma не должны превращаться в «такая кличка уже есть».
  it("не подменяет собой посторонний сбой базы", async () => {
    create.mockRejectedValue(new Error("connection lost"));

    await expect(service.create("u1", draft())).rejects.toThrow("connection lost");
  });
});

describe("PetsService.update", () => {
  /**
   * Хозяин проверяется тем же запросом, что и пишет: сходить сперва за
   * питомцем, а потом обновить его по id — значит оставить щель между
   * проверкой и записью.
   */
  it("правит только своего питомца, одним запросом", async () => {
    await service.update("u1", "pet1", draft({ name: "Микки" }));

    const args = updateMany.mock.calls[0]?.[0] as { where: { id: string; userId: string } };
    expect(args.where).toEqual({ id: "pet1", userId: "u1" });
  });

  it("на чужого или несуществующего отвечает «нет такого»", async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await expect(service.update("u1", "pet9", draft())).rejects.toMatchObject({
      response: { reason: "not-found" },
    });
  });

  it("на совпадение клички отвечает отдельной причиной", async () => {
    updateMany.mockRejectedValue(duplicate());

    await expect(service.update("u1", "pet1", draft())).rejects.toMatchObject({
      response: { reason: "duplicate-name" },
    });
  });

  it("возвращает карточку такой, какой она стала", async () => {
    findFirst.mockResolvedValue(row({ name: "Мика", breed: null }));

    const pet = await service.update("u1", "pet1", draft({ name: "Мика" }));

    expect(pet.name).toBe("Мика");
    expect(pet).not.toHaveProperty("breed");
  });
});

describe("PetsService.remove", () => {
  it("удаляет только своего питомца", async () => {
    await service.remove("u1", "pet1");

    const args = deleteMany.mock.calls[0]?.[0] as { where: Record<string, string> };
    expect(args.where).toEqual({ id: "pet1", userId: "u1" });
  });

  it("на чужого или несуществующего отвечает «нет такого»", async () => {
    deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.remove("u1", "pet9")).rejects.toMatchObject({
      response: { reason: "not-found" },
    });
  });
});
