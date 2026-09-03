import { describe, expect, it } from "vitest";
import {
  INIT_DATA_MAX_AGE_MS,
  signInitData,
  verifyInitData,
} from "./telegram-init-data";

const TOKEN = "123456:AAHtest-bot-token-not-a-real-one";
const NOW = new Date("2026-09-03T12:00:00Z");

const USER = {
  id: 5140053721,
  first_name: "Денис",
  last_name: "Шульга",
  username: "dshulga",
  language_code: "ru",
  photo_url: "https://t.me/i/userpic/320/dshulga.jpg",
};

/** Валидный `initData`, подписанный тем же алгоритмом, что и у Telegram. */
function initData(over: Record<string, string> = {}, token = TOKEN): string {
  return signInitData(
    {
      user: JSON.stringify(USER),
      auth_date: String(Math.floor(NOW.getTime() / 1000)),
      query_id: "AAF_test_query",
      ...over,
    },
    token,
  );
}

describe("verifyInitData — подпись", () => {
  it("принимает данные, подписанные своим токеном", () => {
    const result = verifyInitData(initData(), TOKEN, NOW);

    expect(result.ok).toBe(true);
  });

  // Ровно то, ради чего проверка и существует: подделать вход, не зная токена,
  // нельзя.
  it("отвергает данные, подписанные чужим токеном", () => {
    const foreign = initData({}, "999999:someone-elses-token");

    expect(verifyInitData(foreign, TOKEN, NOW)).toEqual({
      ok: false,
      reason: "bad-signature",
    });
  });

  it("отвергает подмену любого поля после подписи", () => {
    const tampered = initData().replace("5140053721", "5140053722");

    expect(verifyInitData(tampered, TOKEN, NOW)).toMatchObject({
      ok: false,
      reason: "bad-signature",
    });
  });

  it("отвергает данные без подписи", () => {
    const params = new URLSearchParams(initData());
    params.delete("hash");

    expect(verifyInitData(params.toString(), TOKEN, NOW)).toEqual({
      ok: false,
      reason: "no-hash",
    });
  });

  it("отвергает подпись не из шестнадцатеричных цифр и подпись не той длины", () => {
    const params = new URLSearchParams(initData());
    params.set("hash", "не-подпись");
    expect(verifyInitData(params.toString(), TOKEN, NOW)).toMatchObject({
      reason: "bad-signature",
    });

    params.set("hash", "ab");
    expect(verifyInitData(params.toString(), TOKEN, NOW)).toMatchObject({
      reason: "bad-signature",
    });
  });

  it("без токена бота не принимает ничего", () => {
    expect(verifyInitData(initData(), "", NOW)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("на пустой строке не падает", () => {
    expect(verifyInitData("", TOKEN, NOW)).toEqual({ ok: false, reason: "malformed" });
  });
});

describe("verifyInitData — свежесть", () => {
  it("принимает данные в пределах окна", () => {
    const almost = new Date(NOW.getTime() + INIT_DATA_MAX_AGE_MS - 1000);

    expect(verifyInitData(initData(), TOKEN, almost).ok).toBe(true);
  });

  // Подпись у перехваченного `initData` остаётся верной навсегда — окно
  // свежести это единственное, что делает его негодным.
  it("отвергает просроченные данные", () => {
    const late = new Date(NOW.getTime() + INIT_DATA_MAX_AGE_MS + 1000);

    expect(verifyInitData(initData(), TOKEN, late)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  // Подпись верна, но такой `initData` Telegram не выдавал: у кого-то сбиты
  // часы, и доверять времени нельзя ни в какую сторону.
  it("отвергает данные из будущего", () => {
    const early = new Date(NOW.getTime() - INIT_DATA_MAX_AGE_MS - 1000);

    expect(verifyInitData(initData(), TOKEN, early)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("отвергает нечисловой auth_date", () => {
    expect(verifyInitData(initData({ auth_date: "вчера" }), TOKEN, NOW)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });
});

describe("verifyInitData — разбор пользователя", () => {
  it("собирает профиль из подписанных данных", () => {
    const result = verifyInitData(initData(), TOKEN, NOW);

    expect(result.ok && result.data.user).toEqual({
      id: "5140053721",
      username: "dshulga",
      firstName: "Денис",
      lastName: "Шульга",
      photoUrl: "https://t.me/i/userpic/320/dshulga.jpg",
      languageCode: "ru",
      isPremium: false,
    });
  });

  // `initData` обещает только `id`: username может быть не задан, фамилии и
  // фото может не быть вовсе.
  it("не выдумывает полей, которых Telegram не прислал", () => {
    const bare = initData({ user: JSON.stringify({ id: 1, first_name: "Аноним" }) });
    const result = verifyInitData(bare, TOKEN, NOW);

    expect(result.ok && result.data.user).toEqual({
      id: "1",
      firstName: "Аноним",
      isPremium: false,
    });
  });

  it("отмечает премиум-подписку", () => {
    const premium = initData({ user: JSON.stringify({ ...USER, is_premium: true }) });
    const result = verifyInitData(premium, TOKEN, NOW);

    expect(result.ok && result.data.user.isPremium).toBe(true);
  });

  // Telegram-идентификаторы давно вышли за пределы int32, а в JSON они числом:
  // строкой их надо делать сразу, иначе точность теряется по дороге.
  it("держит идентификатор строкой", () => {
    const result = verifyInitData(initData(), TOKEN, NOW);

    expect(result.ok && result.data.user.id).toBe("5140053721");
  });

  it("отвергает данные без пользователя и с нечитаемым пользователем", () => {
    const params = new URLSearchParams(initData());
    params.delete("user");
    const noUser = signInitData(Object.fromEntries(params), TOKEN);
    expect(verifyInitData(noUser, TOKEN, NOW)).toEqual({ ok: false, reason: "no-user" });

    expect(verifyInitData(initData({ user: "{сломано" }), TOKEN, NOW)).toEqual({
      ok: false,
      reason: "no-user",
    });

    expect(verifyInitData(initData({ user: "{}" }), TOKEN, NOW)).toEqual({
      ok: false,
      reason: "no-user",
    });
  });
});

describe("verifyInitData — источник перехода", () => {
  it("достаёт start_param из deep-link", () => {
    const result = verifyInitData(
      initData({ start_param: "utm_source_tiktok_campaign1" }),
      TOKEN,
      NOW,
    );

    expect(result.ok && result.data.startParam).toBe("utm_source_tiktok_campaign1");
  });

  it("без start_param поля нет", () => {
    const result = verifyInitData(initData(), TOKEN, NOW);

    expect(result.ok && result.data).not.toHaveProperty("startParam");
  });

  it("подрезает слишком длинный start_param", () => {
    const result = verifyInitData(initData({ start_param: "u".repeat(500) }), TOKEN, NOW);

    expect(result.ok && result.data.startParam).toHaveLength(200);
  });
});

describe("signInitData", () => {
  // Подписыватель нужен и отладке, и тестам: открыть Mini App в настоящем
  // клиенте можно только с задеплоенного HTTPS, а проверять вход надо раньше.
  it("собирает данные, которые проходят собственную проверку", () => {
    const signed = signInitData(
      { user: JSON.stringify(USER), auth_date: String(Math.floor(NOW.getTime() / 1000)) },
      TOKEN,
    );

    expect(verifyInitData(signed, TOKEN, NOW).ok).toBe(true);
  });

  it("даёт разные подписи для разных токенов", () => {
    const fields = { user: JSON.stringify(USER), auth_date: "1000000" };
    const mine = new URLSearchParams(signInitData(fields, TOKEN)).get("hash");
    const theirs = new URLSearchParams(signInitData(fields, "other:token")).get("hash");

    expect(mine).not.toBe(theirs);
  });
});
