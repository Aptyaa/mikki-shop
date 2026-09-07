import { Injectable, Logger } from "@nestjs/common";
import type { Order } from "@mikki-shop/shared-types";
import { TelegramApi } from "../bot/telegram-api";

/**
 * Сообщение покупателю о смене статуса заказа.
 *
 * Пишется в тот же чат с ботом, из которого покупатель заходил в магазин:
 * `telegramId` и есть `chat_id` личного чата. Отправка может не пройти, и это
 * нормально — бот не имеет права писать первым тому, кто ни разу не нажимал
 * `/start`, а в магазин заходят из кнопки меню, минуя переписку. Поэтому отказ
 * здесь — строка в логе уровня `warn`, а не ошибка: статус уже изменён.
 */
@Injectable()
export class CustomerNotifier {
  private readonly log = new Logger(CustomerNotifier.name);

  constructor(private readonly telegram: TelegramApi) {}

  async notify(order: Order, telegramId: string): Promise<void> {
    const text = customerText(order);
    if (!text) return;

    if (!this.telegram.enabled) {
      this.log.log(`Покупателю не сказано (бот выключен): ${text}`);
      return;
    }

    const sent = await this.telegram.call("sendMessage", { chat_id: telegramId, text });
    if (!sent) {
      this.log.warn(
        `Покупатель не узнал о статусе заказа ${order.number} — обычно это значит, что он не начинал переписку с ботом`,
      );
    }
  }
}

/**
 * Что написать покупателю. `null` — писать нечего.
 *
 * Тексты по правилам бренда: факт и что дальше, без восклицаний и без
 * «спешите». Про `NEW` покупателю не пишут вовсе: он только что оформил заказ
 * и видит его на экране «Мои заказы».
 */
export function customerText(order: Order): string | null {
  switch (order.status) {
    case "CONFIRMED":
      return `Заказ ${order.number} подтверждён. Менеджер свяжется с вами по доставке.`;
    case "SHIPPED":
      return `Заказ ${order.number} отправлен.`;
    case "DONE":
      return `Заказ ${order.number} получен. Спасибо за покупку.`;
    case "CANCELLED":
      return `Заказ ${order.number} отменён. Если это ошибка, напишите менеджеру.`;
    default:
      return null;
  }
}
