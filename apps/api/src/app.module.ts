import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CartModule } from "./cart/cart.module";
import { CatalogModule } from "./catalog/catalog.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    CatalogModule,
    CartModule,
  ],
})
export class AppModule {}
