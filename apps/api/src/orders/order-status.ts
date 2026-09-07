import type { OrderStatus } from "@mikki-shop/shared-types";

/**
 * Куда заказ можно перевести кнопкой.
 *
 * `NEW` сюда не входит: это статус, с которого заявка начинается, и вернуть в
 * него уже подтверждённый заказ нечем — «менеджер ещё не смотрел» после того,
 * как он посмотрел, неправда. Тип нужен и как контракт разбора callback-данных:
 * из чужой кнопки не приедет статус, которого нет.
 */
export type TargetStatus = Exclude<OrderStatus, "NEW">;

/** Статус словом — в заявке менеджеру и в сообщении покупателю. */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: "Новый",
  CONFIRMED: "Подтверждён",
  SHIPPED: "Отправлен",
  DONE: "Получен",
  CANCELLED: "Отменён",
};

/**
 * Что можно нажать из текущего статуса. Пустой список — конец пути.
 *
 * Отмена доступна до самого получения: заказ разворачивают и с дороги, а
 * остатки при отмене возвращаются в любом случае. После `DONE` и `CANCELLED`
 * кнопок нет — иначе отменённый заказ списывал бы остаток второй раз.
 */
export const NEXT_STATUSES: Record<OrderStatus, readonly TargetStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DONE", "CANCELLED"],
  DONE: [],
  CANCELLED: [],
};

/** На кнопке — действие менеджера, а не название статуса: жмут «Отправлен», получая «Отправлен». */
const BUTTON_LABEL: Record<TargetStatus, string> = {
  CONFIRMED: "Подтвердить",
  SHIPPED: "Отправлен",
  DONE: "Получен",
  CANCELLED: "Отменить",
};

/** Разрешён ли переход. */
export function canGo(from: OrderStatus, to: TargetStatus): boolean {
  return NEXT_STATUSES[from].includes(to);
}

/**
 * Данные кнопки: номер заказа, а не `id`.
 *
 * У Telegram на `callback_data` 64 байта, и uuid с префиксом в них влезает
 * впритык, а номер заказа — тот же, что менеджер видит в заявке и называет
 * покупателю по телефону, поэтому в логе отказа он читается без похода в базу.
 */
export function callbackData(number: number, status: TargetStatus): string {
  return `order:${number}:${status}`;
}

/**
 * Разбор `callback_data`.
 *
 * Строго по списку статусов: `callback_data` приходит от клиента Telegram, то
 * есть от кого угодно, кто дотянулся до кнопки. Неизвестное — `null`, а не
 * «наверное, статус».
 */
export function parseCallback(data: string): { number: number; status: TargetStatus } | null {
  const match = /^order:(\d{1,9}):(CONFIRMED|SHIPPED|DONE|CANCELLED)$/.exec(data);
  if (!match?.[1] || !match[2]) return null;
  return { number: Number(match[1]), status: match[2] as TargetStatus };
}

/** Кнопка Telegram. Тип свой: клиента Bot API в проекте нет, а нужен один тип из него. */
export interface InlineKeyboard {
  inline_keyboard: { text: string; callback_data: string }[][];
}

/**
 * Клавиатура под заявкой. `undefined` в конце пути — тогда при правке
 * сообщения `reply_markup` не уедет вовсе, и Telegram уберёт кнопки.
 */
export function statusKeyboard(number: number, status: OrderStatus): InlineKeyboard | undefined {
  const next = NEXT_STATUSES[status];
  if (next.length === 0) return undefined;
  return {
    inline_keyboard: [
      next.map((target) => ({
        text: BUTTON_LABEL[target],
        callback_data: callbackData(number, target),
      })),
    ],
  };
}
