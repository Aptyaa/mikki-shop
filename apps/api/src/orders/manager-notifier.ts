import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { DeliveryMethod, Order } from "@mikki-shop/shared-types";

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
 * Без `MANAGER_CHAT_ID` (или без токена бота) уведомление пишется в лог.
 * Так это работает и сейчас: у проекта ещё нет ни бота, ни адреса, а Bot API
 * из среды разработки недоступен — см. `docs/features/008-telegram-auth.md`.
 */
@Injectable()
export class ManagerNotifier {
  private readonly log = new Logger(ManagerNotifier.name);

  constructor(private readonly config: ConfigService) {}

  async notify(order: Order): Promise<void> {
    const text = format(order);
    const token = this.config.get<string>("TELEGRAM_BOT_TOKEN");
    const chatId = this.config.get<string>("MANAGER_CHAT_ID");

    if (!token || !chatId) {
      this.log.log(`Новая заявка (некому отправить, MANAGER_CHAT_ID не задан):\n${text}`);
      return;
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      if (!response.ok) {
        // Тело ответа Telegram объясняет отказ («chat not found», «bot was
        // blocked») — без него разбираться не в чем.
        this.log.error(
          `Заявка ${order.number} не ушла менеджеру: HTTP ${response.status} ${await response.text()}`,
        );
      }
    } catch (error) {
      this.log.error(`Заявка ${order.number} не ушла менеджеру: ${String(error)}`);
    }
  }
}

/**
 * Текст заявки.
 *
 * Простым текстом, без разметки: в Markdown любая кличка со звёздочкой или
 * подчёркиванием ломает сообщение, а экранировать её ради жирного шрифта не
 * стоит того.
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
  ].join("\n");
}
