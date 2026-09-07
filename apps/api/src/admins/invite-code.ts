import { createHash, randomBytes } from "node:crypto";
import { CODE_BYTES, INVITE_PREFIX } from "./admins.constants";

/**
 * Новый код приглашения.
 *
 * `base64url` — потому что в параметре `start` у Telegram разрешены только
 * латиница, цифры, `_` и `-`: обычный base64 с его `+` и `/` ссылку сломает.
 */
export function newInviteCode(): string {
  return randomBytes(CODE_BYTES).toString("base64url");
}

/**
 * Отпечаток кода для базы.
 *
 * Хранится он, а не сам код: ссылку видят мессенджер, пересылки и бэкапы, и
 * утёкшая база с живым кодом — это чужой менеджер в магазине. Соль не нужна —
 * код случайный и живёт сутки, перебирать нечего.
 */
export function hashInviteCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Код из полезной нагрузки `/start`. Не приглашение (например, UTM) — `null`. */
export function inviteCodeFromPayload(payload: string): string | null {
  if (!payload.startsWith(INVITE_PREFIX)) return null;
  const code = payload.slice(INVITE_PREFIX.length);
  // Ровно тот алфавит, что даёт `base64url`: всё остальное в параметре `start`
  // Telegram и не пропустит, а искать по нему в базе незачем.
  return /^[A-Za-z0-9_-]{8,64}$/.test(code) ? code : null;
}

/** Ссылка-приглашение для пересылки человеку. */
export function inviteLink(botUsername: string, code: string): string {
  return `https://t.me/${botUsername}?start=${INVITE_PREFIX}${code}`;
}
