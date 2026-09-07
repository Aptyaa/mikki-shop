import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { INVITE_TTL_MS } from "./admins.constants";
import { hashInviteCode, newInviteCode } from "./invite-code";

/** Менеджер в списке владельца. */
export interface AdminEntry {
  userId: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  role: "ADMIN" | "OWNER";
}

/** Кто сейчас имеет доступ: заведённые через бота и вписанные в `.env`. */
export interface AdminList {
  /** Из базы — те, кого пригласили. Их можно отозвать кнопкой. */
  invited: AdminEntry[];
  /** Из `.env` — снимаются только правкой файла и перезапуском. */
  fromEnv: string[];
}

/** Профиль приглашённого из `initData`/`message.from` — всё, кроме id, необязательно. */
export interface TelegramProfile {
  telegramId: string;
  username?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
}

export type InviteAccepted =
  | { ok: true; userId: string; invitedBy: string | null }
  | { ok: false; reason: "unknown" | "expired" | "used" | "already-admin" };

export type RevokeResult =
  | { ok: true; telegramId: string; name: string }
  | { ok: false; reason: "not-found" | "not-admin" | "owner" };

/**
 * Кто имеет доступ к заявкам и статусам.
 *
 * Владелец задаётся переменной окружения и только ей: право раздавать доступ
 * нельзя получить из самой системы, иначе первый же приглашённый смог бы
 * разжаловать пригласившего. Менеджеры живут в базе и заводятся приглашением
 * через бота — правка `.env` с перезапуском ради нового человека не годится.
 *
 * `ADMIN_TELEGRAM_IDS` остаётся запасным входом: база сломалась, владельца
 * перепутали — доступ возвращается правкой файла, без миграций и SQL.
 */
@Injectable()
export class AdminsService implements OnModuleInit {
  private readonly log = new Logger(AdminsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Владелец заводится в базе при старте.
   *
   * Иначе его не на что сослаться: приглашение принадлежит тому, кто его
   * выписал, а владелец мог ни разу не заходить в Mini App, и строки `User`
   * у него нет. Роль в базе нужна ещё и списку — показать, кто владелец.
   */
  async onModuleInit(): Promise<void> {
    const ownerId = this.ownerId();
    if (!ownerId) {
      this.log.warn(
        "OWNER_TELEGRAM_ID не задан: приглашать менеджеров через бота будет некому",
      );
      return;
    }

    try {
      await this.prisma.user.upsert({
        where: { telegramId: ownerId },
        create: { telegramId: ownerId, role: "OWNER" },
        update: { role: "OWNER" },
      });
    } catch (error) {
      // База может быть ещё не поднята — это не повод не пускать приложение:
      // право владельца всё равно проверяется по переменной окружения.
      this.log.error(`Владельца не удалось записать в базу: ${String(error)}`);
    }
  }

  /**
   * Владелец — ровно тот, кто указан в окружении.
   *
   * Не роль из базы: роль можно потерять неудачной правкой или чужой рукой, а
   * владелец обязан оставаться владельцем при любом состоянии данных.
   */
  isOwner(telegramId: string): boolean {
    const ownerId = this.ownerId();
    return ownerId !== "" && telegramId === ownerId;
  }

  /** Может ли человек видеть заявки и менять статусы. */
  async isAdmin(telegramId: string): Promise<boolean> {
    if (this.isOwner(telegramId) || this.envAdmins().includes(telegramId)) return true;

    const user = await this.prisma.user.findUnique({
      where: { telegramId },
      select: { role: true },
    });
    return user?.role === "ADMIN" || user?.role === "OWNER";
  }

  /** Кому слать заявку о новом заказе: чат заявок, владелец, менеджеры. */
  async notifyChatIds(): Promise<string[]> {
    const invited = await this.prisma.user.findMany({
      where: { role: { in: ["ADMIN", "OWNER"] } },
      select: { telegramId: true },
    });

    const ids = [
      this.config.get<string>("MANAGER_CHAT_ID") ?? "",
      this.ownerId(),
      ...this.envAdmins(),
      ...invited.map((user) => user.telegramId),
    ].filter(Boolean);

    // Владелец и чат заявок обычно один и тот же id — иначе он получил бы
    // каждую заявку дважды.
    return [...new Set(ids)];
  }

  async list(): Promise<AdminList> {
    const rows = await this.prisma.user.findMany({
      where: { role: { in: ["ADMIN", "OWNER"] } },
      select: { id: true, telegramId: true, username: true, firstName: true, role: true },
      orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    });

    const invited: AdminEntry[] = rows.map((row) => ({
      userId: row.id,
      telegramId: row.telegramId,
      username: row.username,
      firstName: row.firstName,
      role: row.role === "OWNER" ? "OWNER" : "ADMIN",
    }));
    const known = new Set(invited.map((entry) => entry.telegramId));

    return { invited, fromEnv: this.envAdmins().filter((id) => !known.has(id)) };
  }

  /**
   * Выписать приглашение.
   *
   * Наружу код отдаётся один раз и здесь: в базе лежит только его отпечаток,
   * поэтому потерянную ссылку не восстановить — выписывают новую.
   */
  async createInvite(ownerTelegramId: string): Promise<{ code: string; expiresAt: Date }> {
    const owner = await this.prisma.user.upsert({
      where: { telegramId: ownerTelegramId },
      create: { telegramId: ownerTelegramId, role: "OWNER" },
      update: {},
      select: { id: true },
    });

    const code = newInviteCode();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await this.prisma.adminInvite.create({
      data: { codeHash: hashInviteCode(code), createdById: owner.id, expiresAt },
    });

    return { code, expiresAt };
  }

  /**
   * Принять приглашение.
   *
   * Приглашённый мог никогда не заходить в магазин, поэтому пользователь
   * заводится здесь же — из того же `/start`, которым пришёл код.
   */
  async acceptInvite(code: string, profile: TelegramProfile): Promise<InviteAccepted> {
    const invite = await this.prisma.adminInvite.findUnique({
      where: { codeHash: hashInviteCode(code) },
      include: { createdBy: { select: { telegramId: true } } },
    });

    if (!invite) return { ok: false, reason: "unknown" };
    if (invite.usedAt) return { ok: false, reason: "used" };
    if (invite.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };

    // Приглашение при этом не тратится: оно ещё пригодится для кого-то другого.
    if (await this.isAdmin(profile.telegramId)) return { ok: false, reason: "already-admin" };

    const user = await this.prisma.user.upsert({
      where: { telegramId: profile.telegramId },
      create: {
        telegramId: profile.telegramId,
        username: profile.username ?? null,
        firstName: profile.firstName ?? null,
        lastName: profile.lastName ?? null,
        role: "ADMIN",
      },
      update: { role: "ADMIN" },
      select: { id: true },
    });

    // Условный `updateMany`: по одной ссылке, разосланной двоим, менеджером
    // становится тот, кто нажал первым, а не оба.
    const consumed = await this.prisma.adminInvite.updateMany({
      where: { id: invite.id, usedAt: null },
      data: { usedAt: new Date(), usedById: user.id },
    });
    if (consumed.count === 0) {
      // Кто-то успел между чтением и записью. Роль откатываем: доступ должен
      // остаться у того, чьим нажатием ссылка потрачена.
      await this.prisma.user.update({ where: { id: user.id }, data: { role: "CUSTOMER" } });
      return { ok: false, reason: "used" };
    }

    return { ok: true, userId: user.id, invitedBy: invite.createdBy?.telegramId ?? null };
  }

  /** Снять доступ. Владельца снять нельзя — иначе магазин остался бы без хозяина. */
  async revoke(userId: string): Promise<RevokeResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramId: true, username: true, firstName: true, role: true },
    });

    if (!user) return { ok: false, reason: "not-found" };
    if (user.role === "OWNER" || this.isOwner(user.telegramId)) {
      return { ok: false, reason: "owner" };
    }
    if (user.role !== "ADMIN") return { ok: false, reason: "not-admin" };

    await this.prisma.user.update({ where: { id: userId }, data: { role: "CUSTOMER" } });

    return {
      ok: true,
      telegramId: user.telegramId,
      name: user.firstName ?? (user.username ? `@${user.username}` : user.telegramId),
    };
  }

  /**
   * Id владельца.
   *
   * `MANAGER_CHAT_ID` подходит запасным вариантом, только если это личный чат:
   * у группы id отрицательный и не принадлежит человеку, а владелец — человек,
   * который жмёт кнопки.
   */
  private ownerId(): string {
    const owner = (this.config.get<string>("OWNER_TELEGRAM_ID") ?? "").trim();
    if (owner) return owner;

    const manager = (this.config.get<string>("MANAGER_CHAT_ID") ?? "").trim();
    return /^\d+$/.test(manager) ? manager : "";
  }

  /** Запасной список из `.env`. Права те же, но отозвать их можно только правкой файла. */
  private envAdmins(): string[] {
    return (this.config.get<string>("ADMIN_TELEGRAM_IDS") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }
}
