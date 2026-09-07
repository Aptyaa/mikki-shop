import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { AdminsModule } from "./admins/admins.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { BotModule } from "./bot/bot.module";
import { CartModule } from "./cart/cart.module";
import { CatalogModule } from "./catalog/catalog.module";
import { HealthModule } from "./health/health.module";
import { OrdersModule } from "./orders/orders.module";
import { PetsModule } from "./pets/pets.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AdminsModule,
    HealthModule,
    CatalogModule,
    CartModule,
    OrdersModule,
    PetsModule,
    BotModule,
  ],
  // Гвард глобальный: закрыто по умолчанию, открыто через `@Public()`.
  // Забытый декоратор тогда даёт 401 на публичной ручке — это видно сразу,
  // в отличие от забытой защиты на закрытой.
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
