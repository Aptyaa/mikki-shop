import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import type { AuthSession, AuthUser } from "@mikki-shop/shared-types";
import { AuthService, type JwtPayload } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import { Public } from "./public.decorator";

interface LoginBody {
  initData?: unknown;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Обмен `initData` на JWT.
   *
   * Публичный по определению: это и есть вход. POST — `initData` длинный и
   * секретный, в query ему не место; 200, а не 201, — ничего не создаётся,
   * кроме, может быть, самого покупателя, но это деталь реализации.
   */
  @Public()
  @Post("telegram")
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginBody): Promise<AuthSession> {
    const initData = typeof body?.initData === "string" ? body.initData : "";
    return this.auth.login(initData);
  }

  /** Профиль вошедшего. Закрыт: без токена отвечать нечем. */
  @Get("me")
  me(@CurrentUser() user: JwtPayload): Promise<AuthUser> {
    return this.auth.me(user.sub);
  }
}
