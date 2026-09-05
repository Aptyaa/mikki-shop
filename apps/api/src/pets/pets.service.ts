import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { CatalogSize, Pet, PetDraft } from "@mikki-shop/shared-types";

/**
 * Разобранный черновик: мерки уже числа.
 *
 * В `PetDraft` они `number | string`, потому что из формы приезжает набранное
 * владельцем, включая «38,4». Приводит и проверяет их контроллер, и до сервиса
 * доходит только то, что прошло проверку, — тип это и фиксирует, чтобы
 * непроверенная строка не смогла доехать до базы мимо разбора.
 */
export type PetInput = Omit<PetDraft, "chestCm" | "neckCm" | "backCm"> & {
  chestCm?: number;
  neckCm?: number;
  backCm?: number;
};
import { PrismaService } from "../prisma/prisma.service";
import { MAX_PETS } from "./pets.constants";

/** Питомец в том виде, в каком его отдаёт Prisma. */
type PetRow = {
  id: string;
  name: string;
  breed: string | null;
  size: string | null;
  chestCm: number | null;
  neckCm: number | null;
  backCm: number | null;
};

const SELECT = {
  id: true,
  name: true,
  breed: true,
  size: true,
  chestCm: true,
  neckCm: true,
  backCm: true,
} as const;

/**
 * Незаполненные поля не отдаются пустыми строками и нулями, а отсутствуют:
 * ноль сантиметров — это не «мерку не сняли», а невозможная собака, и на
 * экране эти два состояния выглядят по-разному.
 */
function toPet(row: PetRow): Pet {
  return {
    id: row.id,
    name: row.name,
    ...(row.breed ? { breed: row.breed } : {}),
    ...(row.size ? { size: row.size as CatalogSize } : {}),
    ...(row.chestCm != null ? { chestCm: row.chestCm } : {}),
    ...(row.neckCm != null ? { neckCm: row.neckCm } : {}),
    ...(row.backCm != null ? { backCm: row.backCm } : {}),
  };
}

/**
 * Поля черновика в том виде, в каком их принимает Prisma.
 *
 * Пропущенное поле пишется как `null`, а не пропускается: это правка карточки
 * целиком, и стёртая владельцем порода должна стереться и в базе. Иначе
 * очистить однажды заполненное поле было бы нечем.
 */
function toData(draft: PetInput) {
  return {
    name: draft.name,
    breed: draft.breed ?? null,
    size: draft.size ?? null,
    chestCm: draft.chestCm ?? null,
    neckCm: draft.neckCm ?? null,
    backCm: draft.backCm ?? null,
  };
}

/** Нарушение уникальности `(userId, name)` — Prisma отдаёт его кодом P2002. */
function isDuplicate(error: unknown): boolean {
  return (error as { code?: string })?.code === "P2002";
}

@Injectable()
export class PetsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Питомцы покупателя, в порядке появления. */
  async list(userId: string): Promise<Pet[]> {
    const rows = await this.prisma.pet.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: SELECT,
    });
    return rows.map(toPet);
  }

  async create(userId: string, draft: PetInput): Promise<Pet> {
    const count = await this.prisma.pet.count({ where: { userId } });
    if (count >= MAX_PETS) {
      throw new ConflictException({
        reason: "invalid",
        message: `Больше ${MAX_PETS} питомцев в профиль не поместится`,
      });
    }

    try {
      const row = await this.prisma.pet.create({
        data: { userId, ...toData(draft) },
        select: SELECT,
      });
      return toPet(row);
    } catch (error) {
      if (isDuplicate(error)) throw this.duplicate();
      throw error;
    }
  }

  /**
   * Правка карточки.
   *
   * `updateMany` с `userId` в `where`, а не `update` по одному id: иначе
   * пришлось бы сперва сходить за питомцем, чтобы проверить хозяина, и между
   * проверкой и записью осталась бы щель. Здесь чужой питомец просто не
   * попадает под условие, и в ответе честный ноль изменённых строк.
   */
  async update(userId: string, id: string, draft: PetInput): Promise<Pet> {
    try {
      const { count } = await this.prisma.pet.updateMany({
        where: { id, userId },
        data: toData(draft),
      });
      if (count === 0) throw this.notFound();
    } catch (error) {
      if (isDuplicate(error)) throw this.duplicate();
      throw error;
    }

    const row = await this.prisma.pet.findFirst({ where: { id, userId }, select: SELECT });
    if (!row) throw this.notFound();
    return toPet(row);
  }

  /**
   * Удаление.
   *
   * Прошлые заказы при этом не страдают: кличка лежит в самом заказе слепком
   * (`Order.petName`), а обнуление `petId` ссылкой на несуществующего питомца
   * ничего не ломает — связь и заводилась для отчётов.
   */
  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.pet.deleteMany({ where: { id, userId } });
    if (count === 0) throw this.notFound();
  }

  private duplicate(): ConflictException {
    return new ConflictException({
      reason: "duplicate-name",
      message: "Питомец с такой кличкой уже есть",
    });
  }

  private notFound(): NotFoundException {
    return new NotFoundException({ reason: "not-found", message: "Питомца нет" });
  }
}
