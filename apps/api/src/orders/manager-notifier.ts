import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { DeliveryMethod, Order } from "@mikki-shop/shared-types";
import { TelegramApi } from "../bot/telegram-api";
import { STATUS_LABEL, statusKeyboard } from "./order-status";

const DELIVERY_LABEL: Record<DeliveryMethod, string> = {
  courier: "Курьер",
  pickup: "Самовывоз",
  post: "Почта",
};

const money = (value: number): string =>
  `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;

/**
 * Заявка менеджеру в Telegram.
 *
 * Оплаты в MVP нет: заказ — это заявка, по которой менеджер перезванивает.
 * Отправка не входит в транзакцию заказа и не может её сорвать: заказ уже
 * записан, и молчащий бот — повод посмотреть в лог, а не потерять покупателя.
 *
 * Под заявкой висят кнопки статусов — это и есть вся админка заказов на
 * сегодня: менеджер работает с телефона, из того же чата, куда пришла заявка,
 * и отдельного экрана ради четырёх кнопок заводить незачем.
 *
 * Без `MANAGER_CHAT_ID` (или без токена бота) уведомление пишется в лог, а
 * заказы при этом оформляются.
 */
@Injectable()
export class ManagerNotifier {
  private readonly log = new Logger(ManagerNotifier.name);

  constructor(
    private readonly config: ConfigService,
    private readonly telegram: TelegramApi,
  ) {}

  async notify(order: Order): Promise<void> {
    const text = format(order);
    const chatId = this.config.get<string>("MANAGER_CHAT_ID");

    if (!this.telegram.enabled || !chatId) {
      this.log.log(`Новая заявка (некому отправить, MANAGER_CHAT_ID не задан):\n${text}`);
      return;
    }

    const sent = await this.telegram.call("sendMessage", {
      chat_id: chatId,
      text,
      reply_markup: statusKeyboard(order.number, order.status),
    });
    // Причину уже назвал `TelegramApi`; здесь важно, какая именно заявка
    // осталась ненайденной, — по номеру её достают из базы руками.
    if (!sent) this.log.error(`Заявка ${order.number} не ушла менеджеру`);
  }
}

/**
 * Текст заявки.
 *
 * Простым текстом, без разметки: в Markdown любая кличка со звёздочкой или
 * подчёркиванием ломает сообщение, а экранировать её ради жирного шрифта не
 * стоит того.
 *
 * Тем же текстом сообщение переписывается при смене статуса, поэтому статус —
 * его последняя строка: менеджер видит в чате не «была заявка», а «что с
 * заказом сейчас».
 */
export function format(order: Order): string {
  const lines = order.lines.map(
    (line) =>
      `• ${line.title} — ${line.size}${line.color ? `, ${line.color}` : ""}` +
      ` × ${line.quantity} = ${money(line.price * line.quantity)}`,
  );

  return [
    `Заказ ${order.number}`,
    "",
    `${order.customerName}, ${order.phone}`,
    `${DELIVERY_LABEL[order.delivery]}${order.address ? `: ${order.address}` : ""}`,
    ...(order.petName ? [`Питомец: ${order.petName}`] : []),
    ...(order.comment ? [`Комментарий: ${order.comment}`] : []),
    "",
    ...lines,
    "",
    `Итого: ${money(order.total)}`,
    `Статус: ${STATUS_LABEL[order.status]}`,
  ].join("\n");
}
