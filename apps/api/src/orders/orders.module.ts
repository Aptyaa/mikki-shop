import { Module } from "@nestjs/common";
import { AdminsModule } from "../admins/admins.module";
import { CartModule } from "../cart/cart.module";
import { TelegramModule } from "../bot/telegram.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { ManagerNotifier } from "./manager-notifier";
import { CustomerNotifier } from "./customer-notifier";

@Module({
  // Состав и суммы заказа считает тот же сервис, что рисует корзину.
  // `TelegramModule` — чтобы заявка менеджеру и сообщение покупателю ходили
  // тем же клиентом Bot API, что и сам бот. `AdminsModule` знает, кому слать
  // заявку: чат заявок, владелец и приглашённые менеджеры.
  imports: [CartModule, TelegramModule, AdminsModule],
  controllers: [OrdersController],
  providers: [OrdersService, ManagerNotifier, CustomerNotifier],
  // Бот меняет статусы через тот же сервис, что и HTTP-ручки.
  exports: [OrdersService],
})
export class OrdersModule {}
