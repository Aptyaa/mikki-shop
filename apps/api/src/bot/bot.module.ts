import { Module } from "@nestjs/common";
import { OrdersModule } from "../orders/orders.module";
import { BotService } from "./bot.service";
import { TelegramModule } from "./telegram.module";

/** Бот: опрос обновлений, `/start` и кнопки статусов под заявкой менеджеру. */
@Module({
  imports: [TelegramModule, OrdersModule],
  providers: [BotService],
})
export class BotModule {}
