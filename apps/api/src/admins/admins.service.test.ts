import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigService } from "@nestjs/config";
import { AdminsService } from "./admins.service";
import { hashInviteCode } from "./invite-code";
import type { PrismaService } from "../prisma/prisma.service";

const OWNER = "777";
const GUEST = "555";

type Args = Record<string, unknown>;

let env: Record<string, string>;
let userFindUnique: ReturnType<typeof vi.fn>;
let userFindMany: ReturnType<typeof vi.fn>;
let userUpsert: ReturnType<typeof vi.fn>;
let userUpdate: ReturnType<typeof vi.fn>;
let inviteFindUnique: ReturnType<typeof vi.fn>;
let inviteCreate: ReturnType<typeof vi.fn>;
let inviteUpdateMany: ReturnType<typeof vi.fn>;
let service: AdminsService;

/** Живое приглашение того же владельца. */
function invite(over: Args = {}) {
  return {
    id: "i1",
    usedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    createdBy: { telegramId: OWNER },
    ...over,
  };
}

beforeEach(() => {
  env = { OWNER_TELEGRAM_ID: OWNER };
  userFindUnique = vi.fn(async (_args: Args) => null);
  userFindMany = vi.fn(async (_args: Args) => []);
  userUpsert = vi.fn(async (_args: Args) => ({ id: "u1" }));
  userUpdate = vi.fn(async (_args: Args) => ({ id: "u1" }));
  inviteFindUnique = vi.fn(async (_args: Args) => invite());
  inviteCreate = vi.fn(async (_args: Args) => ({ id: "i1" }));
  inviteUpdateMany = vi.fn(async (_args: Args) => ({ count: 1 }));

  service = new AdminsService(
    {
      user: {
        findUnique: userFindUnique,
        findMany: userFindMany,
        upsert: userUpsert,
        update: userUpdate,
      },
      adminInvite: {
        findUnique: inviteFindUnique,
        create: inviteCreate,
        updateMany: inviteUpdateMany,
      },
    } as unknown as PrismaService,
    { get: (key: string) => env[key] } as unknown as ConfigService,
  );
});

describe("кто владелец", () => {
  it("тот, кто указан в окружении", () => {
    expect(service.isOwner(OWNER)).toBe(true);
    expect(service.isOwner(GUEST)).toBe(false);
  });

  /**
   * Владелец обязан оставаться владельцем при любом состоянии базы: роль можно
   * потерять неудачной правкой, а переменную окружения — нет.
   */
  it("не зависит от роли в базе", async () => {
    userFindUnique.mockResolvedValue({ role: "CUSTOMER" });

    expect(service.isOwner(OWNER)).toBe(true);
    expect(await service.isAdmin(OWNER)).toBe(true);
  });

  // Запасной вариант — личный чат заявок. У группы id отрицательный и не
  // принадлежит человеку, который жмёт кнопки.
  it("подхватывает MANAGER_CHAT_ID, только если это личный чат", () => {
    env = { MANAGER_CHAT_ID: OWNER };
    expect(service.isOwner(OWNER)).toBe(true);

    env = { MANAGER_CHAT_ID: "-100500" };
    expect(service.isOwner("-100500")).toBe(false);
  });
});

describe("кто менеджер", () => {
  it("тот, у кого роль в базе", async () => {
    userFindUnique.mockResolvedValue({ role: "ADMIN" });

    expect(await service.isAdmin(GUEST)).toBe(true);
  });

  it("покупатель — нет", async () => {
    userFindUnique.mockResolvedValue({ role: "CUSTOMER" });

    expect(await service.isAdmin(GUEST)).toBe(false);
  });

  it("незнакомец — нет", async () => {
    expect(await service.isAdmin("12345")).toBe(false);
  });

  // Запасной вход на случай, когда база не отвечает или роли перепутаны.
  it("тот, кто вписан в ADMIN_TELEGRAM_IDS, — без похода в базу", async () => {
    env = { ...env, ADMIN_TELEGRAM_IDS: `111, ${GUEST}` };

    expect(await service.isAdmin(GUEST)).toBe(true);
    expect(userFindUnique).not.toHaveBeenCalled();
  });
});

describe("кому слать заявку", () => {
  it("чат заявок, владелец и все менеджеры — по одному разу", async () => {
    env = { OWNER_TELEGRAM_ID: OWNER, MANAGER_CHAT_ID: OWNER, ADMIN_TELEGRAM_IDS: "111" };
    userFindMany.mockResolvedValue([{ telegramId: OWNER }, { telegramId: GUEST }]);

    expect(await service.notifyChatIds()).toEqual([OWNER, "111", GUEST]);
  });

  it("никого не выдумывает, когда доступов нет", async () => {
    env = {};

    expect(await service.notifyChatIds()).toEqual([]);
  });
});

describe("приглашение", () => {
  it("кладёт в базу отпечаток, а наружу отдаёт код", async () => {
    const { code, expiresAt } = await service.createInvite(OWNER);

    const args = inviteCreate.mock.calls[0]?.[0] as { data: { codeHash: string } };
    expect(args.data.codeHash).toBe(hashInviteCode(code));
    // Сам код в базу не попадает: ссылку видят мессенджер, пересылки и бэкапы.
    expect(JSON.stringify(args)).not.toContain(code);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("делает приглашённого менеджером и гасит ссылку", async () => {
    const result = await service.acceptInvite("code", { telegramId: GUEST, firstName: "Аня" });

    expect(result).toMatchObject({ ok: true, invitedBy: OWNER });
    const created = userUpsert.mock.calls[0]?.[0] as { update: { role: string } };
    expect(created.update.role).toBe("ADMIN");
    const consumed = inviteUpdateMany.mock.calls[0]?.[0] as { where: { usedAt: null } };
    // Условие «ещё не потрачено» обязательно: по одной ссылке, разосланной
    // двоим, менеджером становится тот, кто нажал первым.
    expect(consumed.where.usedAt).toBeNull();
  });

  it("отказывает по несуществующему коду", async () => {
    inviteFindUnique.mockResolvedValue(null);

    expect(await service.acceptInvite("code", { telegramId: GUEST })).toEqual({
      ok: false,
      reason: "unknown",
    });
    expect(userUpsert).not.toHaveBeenCalled();
  });

  it("отказывает по потраченной и по протухшей", async () => {
    inviteFindUnique.mockResolvedValue(invite({ usedAt: new Date() }));
    expect(await service.acceptInvite("code", { telegramId: GUEST })).toMatchObject({
      reason: "used",
    });

    inviteFindUnique.mockResolvedValue(invite({ expiresAt: new Date(Date.now() - 1) }));
    expect(await service.acceptInvite("code", { telegramId: GUEST })).toMatchObject({
      reason: "expired",
    });
  });

  // Ссылка при этом не тратится: она ещё пригодится для кого-то другого.
  it("не тратит приглашение на того, у кого доступ уже есть", async () => {
    userFindUnique.mockResolvedValue({ role: "ADMIN" });

    expect(await service.acceptInvite("code", { telegramId: GUEST })).toMatchObject({
      reason: "already-admin",
    });
    expect(inviteUpdateMany).not.toHaveBeenCalled();
  });

  /**
   * Кто-то успел между чтением и записью: доступ должен остаться у того, чьим
   * нажатием ссылка потрачена, а не у обоих.
   */
  it("откатывает роль, если ссылку перехватили в последний момент", async () => {
    inviteUpdateMany.mockResolvedValue({ count: 0 });

    expect(await service.acceptInvite("code", { telegramId: GUEST })).toMatchObject({
      reason: "used",
    });
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: "u1" }, data: { role: "CUSTOMER" } });
  });
});

describe("отзыв доступа", () => {
  it("возвращает менеджера в покупатели", async () => {
    userFindUnique.mockResolvedValue({
      telegramId: GUEST,
      username: null,
      firstName: "Аня",
      role: "ADMIN",
    });

    expect(await service.revoke("u1")).toEqual({ ok: true, telegramId: GUEST, name: "Аня" });
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: "u1" }, data: { role: "CUSTOMER" } });
  });

  // Иначе магазин остался бы без хозяина, и вернуть его можно было бы только SQL.
  it("владельца снять нельзя", async () => {
    userFindUnique.mockResolvedValue({
      telegramId: OWNER,
      username: null,
      firstName: "Денис",
      role: "OWNER",
    });

    expect(await service.revoke("u0")).toEqual({ ok: false, reason: "owner" });
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("покупателя снимать нечего", async () => {
    userFindUnique.mockResolvedValue({
      telegramId: GUEST,
      username: null,
      firstName: null,
      role: "CUSTOMER",
    });

    expect(await service.revoke("u1")).toEqual({ ok: false, reason: "not-admin" });
  });
});

describe("список", () => {
  it("делит доступы на приглашённых и вписанных в .env", async () => {
    env = { OWNER_TELEGRAM_ID: OWNER, ADMIN_TELEGRAM_IDS: `111, ${OWNER}` };
    userFindMany.mockResolvedValue([
      { id: "u0", telegramId: OWNER, username: "den", firstName: "Денис", role: "OWNER" },
    ]);

    const list = await service.list();

    expect(list.invited).toEqual([
      { userId: "u0", telegramId: OWNER, username: "den", firstName: "Денис", role: "OWNER" },
    ]);
    // Владелец уже показан выше — второй раз, как «из .env», он не нужен.
    expect(list.fromEnv).toEqual(["111"]);
  });
});
