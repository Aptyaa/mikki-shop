import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { TOKEN_TTL_SECONDS } from "./auth.constants";

/**
 * Глобальный: `JwtAuthGuard` регистрируется в `AppModule` как `APP_GUARD` и
 * должен видеть `JwtService`, не таща `JwtModule` в каждый модуль отдельно.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Пустой секрет не подставляем: с ним `jsonwebtoken` подписывал бы
        // токены, которые подделает кто угодно. Пусть лучше приложение не
        // поднимется, чем поднимется с открытой дверью.
        secret: required(config, "JWT_SECRET"),
        signOptions: { expiresIn: TOKEN_TTL_SECONDS },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}

function required(config: ConfigService, key: string): string {
  const value = config.get<string>(key);
  if (!value) throw new Error(`${key} не задан — см. .env.example`);
  return value;
}
