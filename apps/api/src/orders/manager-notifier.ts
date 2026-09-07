import { Injectable, Logger } from "@nestjs/common";
import type { DeliveryMethod, Order } from "@mikki-shop/shared-types";
import { AdminsService } from "../admins/admins.service";
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
 * Заявка уходит всем, у кого есть доступ: в чат заявок, владельцу и каждому
 * приглашённому менеджеру. Кнопки нажимает тот, кто взял заказ, — его копия
 * переписывается сразу, а чужие догоняют при первом же нажатии (текст
 * сравнивается с тем, что в чате, и отставшая копия обновляется).
 *
 * Некому отправить (нет ни бота, ни доступов) — уведомление пишется в лог, а
 * заказы при этом оформляются.
 */
@Injectable()
export class ManagerNotifier {
  private readonly log = new Logger(ManagerNotifier.name);

  constructor(
    private readonly admins: AdminsService,
    private readonly telegram: TelegramApi,
  ) {}

  async notify(order: Order): Promise<void> {
    const text = format(order);
    const chatIds = this.telegram.enabled ? await this.admins.notifyChatIds() : [];

    if (chatIds.length === 0) {
      this.log.log(`Новая заявка (некому отправить, доступы не заданы):\n${text}`);
      return;
    }

    const reply_markup = statusKeyboard(order.number, order.status);
    // Последовательно, а не `Promise.all`: заявок в минуту единицы, зато
    // Telegram не отдаёт 429 за пачку одновременных отправок.
    for (const chatId of chatIds) {
      const sent = await this.telegram.call("sendMessage", { chat_id: chatId, text, reply_markup });
      // Причину уже назвал `TelegramApi`; здесь важно, какая заявка и кому не
      // дошла: по номеру её достают из базы руками, а по чату — понимают, что
      // человек, например, не начинал переписку с ботом.
      if (!sent) this.log.error(`Заявка ${order.number} не ушла в чат ${chatId}`);
    }
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
