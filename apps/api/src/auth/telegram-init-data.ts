import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Проверка `initData` от Telegram Mini App.
 *
 * Чистые функции без Nest и без базы: это единственное место, где решается,
 * настоящий перед нами пользователь или подделка, и проверять его тестами надо
 * без контейнера, БД и сети.
 *
 * Алгоритм — из документации Telegram (Validating data received via the Mini
 * App): ключ подписи это `HMAC-SHA256("WebAppData", botToken)`, а подписывается
 * строка из всех полей, кроме `hash`, отсортированных по имени и склеенных
 * через `\n` как `key=value`.
 */

/** Пользователь из поля `user` в `initData`. Всё, кроме `id`, необязательно. */
export interface TelegramUser {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  languageCode?: string;
  isPremium: boolean;
}

export interface TelegramInitData {
  user: TelegramUser;
  /** `start_param` deep-link: источник перехода для аналитики воронки. */
  startParam?: string;
  /** Момент выдачи `initData` Telegram'ом. */
  authDate: Date;
}

export type InitDataFailure =
  | "malformed"
  | "no-hash"
  | "bad-signature"
  | "expired"
  | "no-user";

export type InitDataResult =
  | { ok: true; data: TelegramInitData }
  | { ok: false; reason: InitDataFailure };

/**
 * Сколько `initData` считается свежим.
 *
 * Telegram выдаёт его при открытии Mini App и не обновляет, пока приложение
 * открыто, поэтому окно щедрое: сутки. Без окна вовсе перехваченный `initData`
 * годился бы вечно — подпись-то остаётся верной.
 */
export const INIT_DATA_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function toUser(raw: string): TelegramUser | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const user = parsed as Record<string, unknown>;
  // `id` приходит числом и не влезает в int32 — держим строкой, как в базе.
  const id =
    typeof user.id === "number" && Number.isFinite(user.id)
      ? String(user.id)
      : typeof user.id === "string" && user.id.trim()
        ? user.id.trim()
        : null;
  if (id === null) return null;

  const text = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim() ? value.trim() : undefined;

  return {
    id,
    ...(text(user.username) ? { username: text(user.username) as string } : {}),
    ...(text(user.first_name) ? { firstName: text(user.first_name) as string } : {}),
    ...(text(user.last_name) ? { lastName: text(user.last_name) as string } : {}),
    ...(text(user.photo_url) ? { photoUrl: text(user.photo_url) as string } : {}),
    ...(text(user.language_code) ? { languageCode: text(user.language_code) as string } : {}),
    isPremium: user.is_premium === true,
  };
}

/** Ключ подписи Telegram: HMAC от токена бота под меткой «WebAppData». */
function secretKey(botToken: string): Buffer {
  return createHmac("sha256", "WebAppData").update(botToken).digest();
}

/**
 * Наборы полей, которые в строку подписи не входят.
 *
 * Их два, и это не перестраховка, а факт с телефона. Документация Telegram
 * говорит исключать `hash` и `signature` (второе — поле из Bot API 7.10 для
 * сторонней проверки по Ed25519, когда `initData` показывают тому, у кого нет
 * токена бота). Настоящий клиент iOS считает `hash` иначе: `signature` у него
 * в подписываемой строке **остаётся**, и по документации его вход отвергался
 * как `bad-signature`. Поймать это можно было только живым запуском — перебором
 * вариантов строки прямо на пришедших с телефона данных.
 *
 * Поэтому принимаем оба — с открытыми глазами на то, чем за это платим.
 *
 * Плата ровно одна: приняв второй вариант, мы выводим из-под подписи само поле
 * `signature`. К чужому валидному `initData` можно дописать `&signature=что
 * угодно`, и проверка пройдёт. Это ничего не даёт: `signature` мы не читаем
 * вовсе — ни в профиль, ни в заказ он не попадает, — а чтобы дописать, нужен
 * уже украденный чужой `initData`, который и без всякой дописки годится сам по
 * себе, пока не истечёт окно свежести. Подобрать подпись без токена бота
 * по-прежнему нельзя: обе строки считаются тем же секретом над теми же данными.
 *
 * Отказаться от второго варианта — значит поверить, что все клиенты считают
 * `hash` как iOS. Проверить это можно только на устройствах, а цена ошибки —
 * покупатель, который не может войти, и `bad-signature` в логе вместо
 * объяснения. Ровно этот вечер так и прошёл.
 */
const UNSIGNED_VARIANTS: readonly (readonly string[])[] = [
  ["hash"],
  ["hash", "signature"],
];

/** Строка подписи: поля по алфавиту, `key=value`, через перевод строки. */
function checkString(params: URLSearchParams, unsigned: readonly string[]): string {
  return [...params.entries()]
    .filter(([key]) => !unsigned.includes(key))
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join(String.fromCharCode(10));
}

/**
 * Разобрать и проверить `initData`.
 *
 * Возвращает причину отказа, а не бросает: контроллер отвечает на все причины
 * одинаковым 401, но в логе полезно видеть, что именно не сошлось.
 */
export function verifyInitData(
  initData: string,
  botToken: string,
  now: Date = new Date(),
  maxAgeMs: number = INIT_DATA_MAX_AGE_MS,
): InitDataResult {
  if (!initData || !botToken) return { ok: false, reason: "malformed" };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "no-hash" };

  let given: Buffer;
  try {
    given = Buffer.from(hash, "hex");
  } catch {
    return { ok: false, reason: "bad-signature" };
  }
  const key = secretKey(botToken);
  // Сравнение постоянного времени: обычное `===` на строках выходит из цикла на
  // первом различии, и по времени ответа подпись подбирается побайтово. Оба
  // варианта считаются целиком, без выхода на первом совпадении: иначе по
  // времени ответа видно, какой из них сошёлся.
  const matched = UNSIGNED_VARIANTS.reduce((found, unsigned) => {
    const expected = createHmac("sha256", key)
      .update(checkString(params, unsigned))
      .digest();
    const same = given.length === expected.length && timingSafeEqual(given, expected);
    return found || same;
  }, false);
  if (!matched) return { ok: false, reason: "bad-signature" };

  const authDateRaw = Number.parseInt(params.get("auth_date") ?? "", 10);
  if (!Number.isFinite(authDateRaw)) return { ok: false, reason: "malformed" };
  const authDate = new Date(authDateRaw * 1000);
  // Будущее тоже отвергаем: подпись верна, но такой `initData` Telegram не
  // выдавал — значит, у кого-то из нас сбиты часы, и доверять времени нельзя.
  const age = now.getTime() - authDate.getTime();
  if (age > maxAgeMs || age < -maxAgeMs) return { ok: false, reason: "expired" };

  const rawUser = params.get("user");
  if (!rawUser) return { ok: false, reason: "no-user" };
  const user = toUser(rawUser);
  if (!user) return { ok: false, reason: "no-user" };

  const startParam = params.get("start_param")?.trim();

  return {
    ok: true,
    data: {
      user,
      ...(startParam ? { startParam: startParam.slice(0, 200) } : {}),
      authDate,
    },
  };
}

/**
 * Собрать подписанный `initData` — тем же алгоритмом, которым его собирает
 * Telegram.
 *
 * Живёт в рантайме, а не в тестах, потому что нужна и локальной отладке:
 * открыть Mini App в настоящем клиенте можно только с задеплоенного HTTPS,
 * а до этого проверять вход нечем. Ключ подписи всё равно нужен, так что
 * подделать этим чужой вход нельзя.
 */
export function signInitData(
  fields: Record<string, string>,
  botToken: string,
  /**
   * Что не подписывать. По умолчанию — только `hash`, как делает живой клиент:
   * `signature`, если он передан, в строку подписи входит. Второй набор нужен
   * тестам, чтобы проверить и вариант из документации.
   */
  unsigned: readonly string[] = UNSIGNED_VARIANTS[0]!,
): string {
  const params = new URLSearchParams(fields);
  const hash = createHmac("sha256", secretKey(botToken))
    .update(checkString(params, unsigned))
    .digest("hex");
  params.set("hash", hash);
  return params.toString();
}
