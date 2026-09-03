import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Reflector } from "@nestjs/core";
import type { JwtService } from "@nestjs/jwt";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { JwtPayload } from "./auth.service";

const PAYLOAD: JwtPayload = { sub: "u1", telegramId: "5140053721" };

interface FakeRequest {
  headers: { authorization?: string };
  user?: JwtPayload;
}

function makeContext(authorization?: string) {
  const request: FakeRequest = {
    headers: authorization === undefined ? {} : { authorization },
  };
  return {
    request,
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    } as never,
  };
}

let verify: ReturnType<typeof vi.fn>;
let isPublic: boolean;
let guard: JwtAuthGuard;

beforeEach(() => {
  verify = vi.fn(() => PAYLOAD);
  isPublic = false;
  const reflector = { getAllAndOverride: () => isPublic } as unknown as Reflector;
  guard = new JwtAuthGuard({ verify } as unknown as JwtService, reflector);
});

describe("JwtAuthGuard — закрытый маршрут", () => {
  it("пропускает с валидным токеном и кладёт пользователя в запрос", async () => {
    const { context, request } = makeContext("Bearer token");

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(PAYLOAD);
  });

  it("не пропускает без заголовка", async () => {
    const { context } = makeContext();

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401 });
  });

  it("не пропускает с битым токеном", async () => {
    verify.mockImplementation(() => {
      throw new Error("jwt malformed");
    });
    const { context } = makeContext("Bearer сломан");

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401 });
  });

  // Токен подписан нами, но полезная нагрузка могла остаться от прошлой версии
  // формата: без `sub` непонятно, кто это, и пускать нельзя.
  it("не пропускает токен без sub", async () => {
    verify.mockReturnValue({ telegramId: "1" } as unknown as JwtPayload);
    const { context } = makeContext("Bearer token");

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401 });
  });

  it("понимает схему Bearer в любом регистре и отвергает чужие схемы", async () => {
    await expect(guard.canActivate(makeContext("bearer token").context)).resolves.toBe(true);
    await expect(guard.canActivate(makeContext("BEARER token").context)).resolves.toBe(true);

    await expect(
      guard.canActivate(makeContext("Basic dXNlcjpwYXNz").context),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("не принимает заголовок без токена", async () => {
    await expect(guard.canActivate(makeContext("Bearer").context)).rejects.toMatchObject({
      status: 401,
    });
    await expect(guard.canActivate(makeContext("Bearer   ").context)).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe("JwtAuthGuard — публичный маршрут", () => {
  beforeEach(() => {
    isPublic = true;
  });

  it("пропускает без токена", async () => {
    const { context, request } = makeContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  // Каталог всем отдаёт одно и то же, но знать, кто его смотрит, полезно —
  // и `@Public()` не должен этого лишать.
  it("узнаёт вошедшего, если токен всё-таки прислали", async () => {
    const { context, request } = makeContext("Bearer token");

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(PAYLOAD);
  });

  it("не падает на битом токене, а просто не узнаёт пользователя", async () => {
    verify.mockImplementation(() => {
      throw new Error("jwt expired");
    });
    const { context, request } = makeContext("Bearer протухший");

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });
});
