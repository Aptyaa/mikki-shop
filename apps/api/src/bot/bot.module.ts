import { Module } from "@nestjs/common";
import { AdminsModule } from "../admins/admins.module";
import { OrdersModule } from "../orders/orders.module";
import { BotService } from "./bot.service";
import { TelegramModule } from "./telegram.module";

/** Бот: опрос обновлений, `/start`, приглашение менеджеров и кнопки статусов. */
@Module({
  imports: [TelegramModule, OrdersModule, AdminsModule],
  providers: [BotService],
})
export class BotModule {}
