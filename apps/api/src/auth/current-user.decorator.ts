import { type ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { Request } from "express";
import type { JwtPayload } from "./auth.service";

/** Вошедший пользователь, положенный в запрос гвардом. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload | undefined =>
    (context.switchToHttp().getRequest<Request & { user?: JwtPayload }>()).user,
);
