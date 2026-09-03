import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { signInitData } from "./telegram-init-data";
import type { PrismaService } from "../prisma/prisma.service";

const TOKEN = "123456:AAHtest-bot-token-not-a-real-one";

const USER = { id: 5140053721, first_name: "Денис", username: "dshulga" };

function initData(over: Record<string, string> = {}, token = TOKEN): string {
  return signInitData(
    {
      user: JSON.stringify(USER),
      auth_date: String(Math.floor(Date.now() / 1000)),
      ...over,
    },
    token,
  );
}

/** Строка, которую вернул бы Prisma после upsert. */
function row(over: Record<string, unknown> = {}) {
  return {
    id: "u1",
    telegramId: "5140053721",
    username: "dshulga",
    firstName: "Денис",
    lastName: null,
    photoUrl: null,
    isPremium: false,
    ...over,
  };
}

let upsert: ReturnType<typeof vi.fn>;
let findUnique: ReturnType<typeof vi.fn>;
let sign: ReturnType<typeof vi.fn>;
let botToken: string;
let service: AuthService;

beforeEach(() => {
  upsert = vi.fn(async (_args: Record<string, unknown>) => row());
  findUnique = vi.fn(async (_args: Record<string, unknown>) => row());
  sign = vi.fn(() => "signed.jwt.token");
  botToken = TOKEN;

  service = new AuthService(
    { user: { upsert, findUnique } } as unknown as PrismaService,
    { sign } as unknown as JwtService,
    { get: (key: string) => (key === "TELEGRAM_BOT_TOKEN" ? botToken : undefined) } as ConfigService,
  );
});

describe("AuthService.login", () => {
  it("пускает по данным, подписанным токеном бота, и отдаёт сессию", async () => {
    const session = await service.login(initData());

    expect(session).toMatchObject({
      token: "signed.jwt.token",
      user: { id: "u1", telegramId: "5140053721", username: "dshulga", firstName: "Денис" },
    });
    expect(session.expiresAt).toBeGreaterThan(Date.now());
  });

  it("кладёт в токен наш идентификатор, а не телеграмовский", async () => {
    await service.login(initData());

    expect(sign).toHaveBeenCalledWith({ sub: "u1", telegramId: "5140053721" });
  });

  it("не пускает по данным с чужой подписью", async () => {
    await expect(service.login(initData({}, "999:чужой"))).rejects.toMatchObject({
      status: 401,
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("не пускает по пустым данным", async () => {
    await expect(service.login("")).rejects.toMatchObject({ status: 401 });
  });

  // Без токена проверить подпись нечем. Тихо пускать всех подряд — худшее,
  // что тут можно сделать, поэтому вход просто выключен.
  it("без токена бота не пускает никого, даже с верными данными", async () => {
    const signed = initData();
    botToken = "";

    await expect(service.login(signed)).rejects.toMatchObject({ status: 401 });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("не выдаёт наружу, что именно не сошлось", async () => {
    const bad = service.login(initData({}, "999:чужой")).catch((error: Error) => error.message);
    const empty = service.login("").catch((error: Error) => error.message);

    expect(await bad).toBe(await empty);
  });
});

describe("AuthService.login — профиль", () => {
  it("заводит покупателя при первом входе и обновляет при следующих", async () => {
    await service.login(initData());
    const args = upsert.mock.calls[0]?.[0] as {
      where: { telegramId: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };

    expect(args.where).toEqual({ telegramId: "5140053721" });
    expect(args.create).toMatchObject({ telegramId: "5140053721", firstName: "Денис" });
    expect(args.update).toMatchObject({ firstName: "Денис" });
  });

  it("отмечает каждый вход временем", async () => {
    await service.login(initData());
    const args = upsert.mock.calls[0]?.[0] as { update: { lastSeenAt: Date } };

    expect(args.update.lastSeenAt).toBeInstanceOf(Date);
  });

  it("обнуляет поля, которых Telegram больше не присылает", async () => {
    await service.login(initData({ user: JSON.stringify({ id: 1, first_name: "Аноним" }) }));
    const args = upsert.mock.calls[0]?.[0] as { update: Record<string, unknown> };

    // Снял username в Telegram — он должен исчезнуть и у нас, а не остаться
    // висеть от прошлого входа.
    expect(args.update.username).toBeNull();
  });
});

describe("AuthService.login — источник перехода", () => {
  it("запоминает источник при заведении покупателя", async () => {
    await service.login(initData({ start_param: "utm_source_tiktok_campaign1" }));
    const args = upsert.mock.calls[0]?.[0] as { create: { utmSource: string | null } };

    expect(args.create.utmSource).toBe("utm_source_tiktok_campaign1");
  });

  // Иначе переход по чужой ссылке переписал бы источник, который реально
  // привёл покупателя, и вся аналитика воронки поехала бы.
  it("не переписывает источник у того, кто уже заходил", async () => {
    await service.login(initData({ start_param: "utm_source_vk" }));
    const args = upsert.mock.calls[0]?.[0] as { update: Record<string, unknown> };

    expect(args.update).not.toHaveProperty("utmSource");
  });
});

describe("AuthService.me", () => {
  it("читает профиль из базы, а не из токена", async () => {
    findUnique.mockResolvedValue(row({ firstName: "Новое имя" }));

    await expect(service.me("u1")).resolves.toMatchObject({ firstName: "Новое имя" });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "u1" } });
  });

  it("на исчезнувшего пользователя отвечает 401, а не пустым профилем", async () => {
    findUnique.mockResolvedValue(null);

    await expect(service.me("u1")).rejects.toMatchObject({ status: 401 });
  });

  it("не выдумывает необязательных полей", async () => {
    findUnique.mockResolvedValue(row({ username: null, lastName: null, photoUrl: null }));
    const user = await service.me("u1");

    expect(user).not.toHaveProperty("username");
    expect(user).not.toHaveProperty("lastName");
    expect(user).not.toHaveProperty("photoUrl");
  });
});
