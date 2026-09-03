import { describe, expect, it } from "vitest";
import { plural } from "./plural";

/** Ровно те три формы, что нужны шапке каталога: «28 моделей». */
const models = (count: number) => plural(count, "модель", "модели", "моделей");

describe("plural", () => {
  it("склоняет первый десяток", () => {
    expect(models(1)).toBe("модель");
    expect(models(2)).toBe("модели");
    expect(models(3)).toBe("модели");
    expect(models(4)).toBe("модели");
    expect(models(5)).toBe("моделей");
    expect(models(9)).toBe("моделей");
    expect(models(10)).toBe("моделей");
  });

  it("на пустой выдаче даёт «0 моделей»", () => {
    expect(models(0)).toBe("моделей");
  });

  // Главная ловушка русского счёта: 11–14 идут в «моделей», хотя по последней
  // цифре просились бы в «модель»/«модели».
  it("отдаёт 11–14 в форму множественного, вопреки последней цифре", () => {
    expect(models(11)).toBe("моделей");
    expect(models(12)).toBe("моделей");
    expect(models(13)).toBe("моделей");
    expect(models(14)).toBe("моделей");
    expect(models(111)).toBe("моделей");
    expect(models(112)).toBe("моделей");
  });

  it("считает по двум последним цифрам, а не по величине числа", () => {
    expect(models(21)).toBe("модель");
    expect(models(22)).toBe("модели");
    expect(models(25)).toBe("моделей");
    expect(models(101)).toBe("модель");
    expect(models(1024)).toBe("модели");
  });

  it("не зависит от знака", () => {
    expect(models(-1)).toBe("модель");
    expect(models(-13)).toBe("моделей");
  });
});
