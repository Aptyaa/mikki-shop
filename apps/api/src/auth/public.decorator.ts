import { SetMetadata } from "@nestjs/common";
import { IS_PUBLIC } from "./auth.constants";

/**
 * Маршрут доступен без входа.
 *
 * Guard включён глобально: закрыто по умолчанию, открыто по решению. Обратный
 * порядок означал бы, что забытый декоратор оставляет ручку без защиты, и
 * заметить это можно только по факту утечки.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);
