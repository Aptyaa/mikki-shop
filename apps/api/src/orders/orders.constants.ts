import type { DeliveryMethod } from "@mikki-shop/shared-types";

/** Способы получения. Адрес нужен не всем — самовывоз обходится без него. */
export const DELIVERY_METHODS: readonly DeliveryMethod[] = ["courier", "pickup", "post"];

/** Кому нужен адрес доставки. */
export const DELIVERY_NEEDS_ADDRESS: readonly DeliveryMethod[] = ["courier", "post"];

/** Ограничения полей формы — чтобы в базу не уехал роман вместо комментария. */
export const MAX_NAME = 100;
export const MAX_PHONE = 30;
export const MAX_ADDRESS = 500;
export const MAX_COMMENT = 1000;

/**
 * Предел клички — из модуля питомцев, а не свой.
 *
 * Кличка попадает в ту же уникальную `Pet.name` с двух сторон: из формы заказа
 * и из карточки питомца. Разъехавшиеся пределы молча переименовывали бы
 * питомца и заводили бы ему дубль при следующем заказе.
 */
export { MAX_PET_NAME } from "../pets/pets.constants";
