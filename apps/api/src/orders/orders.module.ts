import { Module } from "@nestjs/common";
import { CartModule } from "../cart/cart.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { ManagerNotifier } from "./manager-notifier";

@Module({
  // Состав и суммы заказа считает тот же сервис, что рисует корзину.
  imports: [CartModule],
  controllers: [OrdersController],
  providers: [OrdersService, ManagerNotifier],
})
export class OrdersModule {}
