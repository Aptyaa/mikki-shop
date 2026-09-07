import { describe, expect, it } from "vitest";
import { hashInviteCode, inviteCodeFromPayload, inviteLink, newInviteCode } from "./invite-code";

describe("код приглашения", () => {
  it("каждый раз новый", () => {
    expect(newInviteCode()).not.toBe(newInviteCode());
  });

  /** В параметре `start` у Telegram разрешены только латиница, цифры, `_` и `-`. */
  it("состоит из того, что Telegram пропустит в ссылке", () => {
    for (let i = 0; i < 50; i += 1) expect(newInviteCode()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("превращается в отпечаток одинаково, но не обратимо", () => {
    const code = newInviteCode();

    expect(hashInviteCode(code)).toBe(hashInviteCode(code));
    expect(hashInviteCode(code)).not.toContain(code);
    expect(hashInviteCode(code)).toHaveLength(64);
  });
});

describe("inviteCodeFromPayload", () => {
  it("достаёт код из нагрузки `/start`", () => {
    expect(inviteCodeFromPayload("admin_SGVsbG8gd29ybGQ")).toBe("SGVsbG8gd29ybGQ");
  });

  // Та же нагрузка приезжает от рекламных ссылок — путать их нельзя.
  it("не принимает за приглашение UTM-метку и мусор", () => {
    expect(inviteCodeFromPayload("utm_tiktok")).toBeNull();
    expect(inviteCodeFromPayload("")).toBeNull();
    expect(inviteCodeFromPayload("admin_")).toBeNull();
    expect(inviteCodeFromPayload("admin_короткий")).toBeNull();
    expect(inviteCodeFromPayload(`admin_${"x".repeat(65)}`)).toBeNull();
  });
});

describe("inviteLink", () => {
  it("собирает ссылку, которую можно переслать", () => {
    expect(inviteLink("MikkiBot", "abc")).toBe("https://t.me/MikkiBot?start=admin_abc");
  });
});
