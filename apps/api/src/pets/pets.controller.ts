import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from "@nestjs/common";
import type { CatalogSize, Pet, PetDraft } from "@mikki-shop/shared-types";
import { CATALOG_SIZES } from "../catalog/catalog.constants";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtPayload } from "../auth/auth.service";
import { MAX_BREED, MAX_CM, MAX_PET_NAME, MIN_CM } from "./pets.constants";
import { PetsService } from "./pets.service";

/** Тело запроса до разбора: пришло от клиента, доверия к нему нет. */
interface PetBody {
  name?: unknown;
  breed?: unknown;
  size?: unknown;
  chestCm?: unknown;
  neckCm?: unknown;
  backCm?: unknown;
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function isSize(value: unknown): value is CatalogSize {
  return typeof value === "string" && (CATALOG_SIZES as readonly string[]).includes(value);
}

/**
 * Мерка в сантиметрах.
 *
 * Пустое поле — это «не мерил», и оно проходит; а вот присланная чепуха
 * (ноль, минус, «примерно 30») отвергается, а не приводится к чему-нибудь
 * молча: мерки нужны, чтобы подобрать размер, и тихо испорченная мерка хуже
 * незаполненной. Число принимается и строкой — из формы приходит именно она.
 */
function cm(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;

  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed)) {
    throw new BadRequestException({ reason: "invalid", message: `${field}: нужно число в сантиметрах` });
  }

  const rounded = Math.round(parsed);
  if (rounded < MIN_CM || rounded > MAX_CM) {
    throw new BadRequestException({
      reason: "invalid",
      message: `${field}: от ${MIN_CM} до ${MAX_CM} см`,
    });
  }
  return rounded;
}

/**
 * Разбор карточки.
 *
 * Как и на оформлении заказа, на плохих данных отвечаем ошибкой, а не молча
 * чистим вход: это форма, и владельцу надо знать, что именно поправить.
 */
export function toPetDraft(body: PetBody): PetDraft {
  const name = text(body?.name, MAX_PET_NAME);
  if (!name) {
    throw new BadRequestException({ reason: "invalid", message: "Укажите кличку" });
  }

  const breed = text(body?.breed, MAX_BREED);
  const chestCm = cm(body?.chestCm, "Обхват груди");
  const neckCm = cm(body?.neckCm, "Обхват шеи");
  const backCm = cm(body?.backCm, "Длина спины");

  return {
    name,
    ...(breed ? { breed } : {}),
    // Размер не из сетки — это не ошибка формы, а мусор в запросе: молча
    // отбрасываем, как отбрасываются неизвестные фильтры каталога.
    ...(isSize(body?.size) ? { size: body.size } : {}),
    ...(chestCm !== undefined ? { chestCm } : {}),
    ...(neckCm !== undefined ? { neckCm } : {}),
    ...(backCm !== undefined ? { backCm } : {}),
  };
}

/** Питомцы покупателя. Закрыто целиком: чужие собаки никого не касаются. */
@Controller("pets")
export class PetsController {
  constructor(private readonly pets: PetsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload): Promise<Pet[]> {
    return this.pets.list(user.sub);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() body: PetBody): Promise<Pet> {
    return this.pets.create(user.sub, toPetDraft(body));
  }

  /**
   * PATCH, а не PUT, по привычке HTTP-словаря проекта — но тело приходит
   * целиком: экран правит карточку формой, а не отдельные поля. Стёртое в
   * форме поле стирается и в базе, иначе очистить его было бы нечем.
   */
  @Patch(":id")
  update(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: PetBody,
  ): Promise<Pet> {
    return this.pets.update(user.sub, id, toPetDraft(body));
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: JwtPayload, @Param("id") id: string): Promise<void> {
    return this.pets.remove(user.sub, id);
  }
}
