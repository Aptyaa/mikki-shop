import { Module } from "@nestjs/common";
import { TelegramApi } from "./telegram-api";

/**
 * Клиент Bot API отдельным модулем от самого бота: им пользуются и заявка
 * менеджеру, и сообщения покупателю (модуль заказов), и опрос обновлений
 * (модуль бота). Иначе модуль заказов пришлось бы завязать на модуль бота,
 * который сам зависит от заказов, — то есть закольцевать.
 */
@Module({
  providers: [TelegramApi],
  exports: [TelegramApi],
})
export class TelegramModule {}
