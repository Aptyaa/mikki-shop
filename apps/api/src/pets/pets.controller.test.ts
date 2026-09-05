import { describe, expect, it } from "vitest";
import { MAX_BREED, MAX_CM, MAX_PET_NAME, MIN_CM } from "./pets.constants";
import { toPetDraft } from "./pets.controller";

/** Причина отказа из тела ошибки NestJS. */
function reasonOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return ((error as { response?: { reason?: string } }).response?.reason) ?? "";
  }
  return "";
}

describe("toPetDraft — кличка", () => {
  it("берёт кличку и обрезает пробелы", () => {
    expect(toPetDraft({ name: "  Микки  " })).toEqual({ name: "Микки" });
  });

  it("без клички отказывает", () => {
    expect(reasonOf(() => toPetDraft({}))).toBe("invalid");
    expect(reasonOf(() => toPetDraft({ name: "   " }))).toBe("invalid");
    expect(reasonOf(() => toPetDraft({ name: 42 }))).toBe("invalid");
  });

  it("режет слишком длинную кличку, а не отказывает", () => {
    const draft = toPetDraft({ name: "а".repeat(MAX_PET_NAME + 50) });
    expect(draft.name).toHaveLength(MAX_PET_NAME);
  });

  it("режет слишком длинную породу", () => {
    const draft = toPetDraft({ name: "Микки", breed: "б".repeat(MAX_BREED + 50) });
    expect(draft.breed).toHaveLength(MAX_BREED);
  });
});

describe("toPetDraft — размер", () => {
  it("берёт размер из сетки магазина", () => {
    expect(toPetDraft({ name: "Микки", size: "S" }).size).toBe("S");
  });

  it("пустой размер — это «не выбран», и он проходит", () => {
    expect(toPetDraft({ name: "Микки" })).not.toHaveProperty("size");
    expect(toPetDraft({ name: "Микки", size: "" })).not.toHaveProperty("size");
    expect(toPetDraft({ name: "Микки", size: null })).not.toHaveProperty("size");
  });

  /**
   * Молча отбросить нельзя: тело PATCH заменяет карточку целиком, и
   * пропущенный размер means «стереть сохранённый». Владелец при этом ничего
   * не стирал — он прислал размер, просто негодный.
   */
  it("размер не из сетки отвергает, а не стирает молча", () => {
    expect(reasonOf(() => toPetDraft({ name: "Микки", size: "XXXL" }))).toBe("invalid");
    expect(reasonOf(() => toPetDraft({ name: "Микки", size: 3 }))).toBe("invalid");
  });
});

describe("toPetDraft — мерки", () => {
  it("принимает число и строку из формы", () => {
    expect(toPetDraft({ name: "Микки", chestCm: 38 }).chestCm).toBe(38);
    expect(toPetDraft({ name: "Микки", chestCm: "38" }).chestCm).toBe(38);
  });

  it("понимает запятую как разделитель и округляет", () => {
    expect(toPetDraft({ name: "Микки", chestCm: "38,4" }).chestCm).toBe(38);
    expect(toPetDraft({ name: "Микки", neckCm: "24,6" }).neckCm).toBe(25);
  });

  it("пустое поле — это «не мерил», а не ошибка", () => {
    const draft = toPetDraft({ name: "Микки", chestCm: "", neckCm: null, backCm: undefined });
    expect(draft).not.toHaveProperty("chestCm");
    expect(draft).not.toHaveProperty("neckCm");
    expect(draft).not.toHaveProperty("backCm");
  });

  // Мерки нужны, чтобы подобрать размер: тихо испорченная мерка хуже пустой.
  it("на чепуху в мерке отказывает, а не чинит молча", () => {
    expect(reasonOf(() => toPetDraft({ name: "Микки", chestCm: "примерно 30" }))).toBe("invalid");
    expect(reasonOf(() => toPetDraft({ name: "Микки", chestCm: 0 }))).toBe("invalid");
    expect(reasonOf(() => toPetDraft({ name: "Микки", chestCm: -5 }))).toBe("invalid");
    expect(reasonOf(() => toPetDraft({ name: "Микки", chestCm: MAX_CM + 1 }))).toBe("invalid");
  });

  it("границы диапазона проходят", () => {
    expect(toPetDraft({ name: "Микки", chestCm: MIN_CM }).chestCm).toBe(MIN_CM);
    expect(toPetDraft({ name: "Микки", chestCm: MAX_CM }).chestCm).toBe(MAX_CM);
  });

  it("говорит, какая именно мерка не подошла", () => {
    try {
      toPetDraft({ name: "Микки", backCm: 999 });
      expect.unreachable();
    } catch (error) {
      const message = (error as { response?: { message?: string } }).response?.message ?? "";
      expect(message).toContain("Длина спины");
    }
  });
});
