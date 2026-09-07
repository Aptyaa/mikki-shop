import { Module } from "@nestjs/common";
import { AdminsService } from "./admins.service";

/**
 * Кто имеет доступ к заявкам: владелец из окружения, менеджеры из базы.
 *
 * Отдельным модулем от бота: список нужен и заявке (кому её слать), и боту
 * (кто нажал кнопку), а позже — ролевому guard будущей веб-админки.
 */
@Module({
  providers: [AdminsService],
  exports: [AdminsService],
})
export class AdminsModule {}
