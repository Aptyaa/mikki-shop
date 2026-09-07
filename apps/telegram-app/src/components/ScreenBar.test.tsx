// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ScreenBar } from "./ScreenBar";
import { ScreenLayer } from "./ScreenLayer";

/** Заглушка нативной кнопки: её не должно трогать даже внутри клиента. */
const back = {
  show: vi.fn(),
  hide: vi.fn(),
  onClick: vi.fn(),
  offClick: vi.fn(),
};

function enterTelegram() {
  window.Telegram = {
    WebApp: {
      initData: "user=%7B%22id%22%3A1%7D&hash=abc",
      // Настоящий клиент, а не заглушка `telegram-web-app.js` в браузере:
      // отличаются они именно `platform`.
      platform: "ios",
      ready: vi.fn(),
      onEvent: vi.fn(),
      offEvent: vi.fn(),
      BackButton: back,
    } as never,
  };
}

afterEach(() => {
  cleanup();
  delete window.Telegram;
  vi.clearAllMocks();
});

describe("ScreenBar — заголовок", () => {
  // Маскот из шапки убран: на телефоне голова за названием раздела читалась
  // пятном. Заголовок остался текстом, и никаких картинок в полосе нет.
  it("рисует заголовок текстом, без картинок", () => {
    const { container } = render(<ScreenBar title="Каталог" />);

    expect(screen.getByText("Каталог")).toBeTruthy();
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.textContent).toBe("Каталог");
  });

  it("экран без заголовка обходится пустой полосой", () => {
    const { container } = render(<ScreenBar />);

    expect(container.querySelectorAll("img")).toHaveLength(0);
  });

  it("нестроковый заголовок оставляет как есть", () => {
    render(<ScreenBar title={<b>Готово</b>} />);

    expect(screen.getByText("Готово")).toBeTruthy();
  });
});

describe("ScreenBar — кнопка «назад»", () => {
  it("рисует свою кнопку и зовёт обработчик", () => {
    const onBack = vi.fn();
    render(<ScreenBar title="Корзина" onBack={onBack} />);

    fireEvent.click(screen.getByRole("button", { name: "Назад" }));

    expect(onBack).toHaveBeenCalled();
  });

  it("без onBack кнопки нет вовсе", () => {
    render(<ScreenBar title="Каталог" />);

    expect(screen.queryByRole("button", { name: "Назад" })).toBeNull();
  });

  /**
   * Главное в этой правке: внутри Telegram шапка ведёт себя ровно так же, как
   * в браузере. Нативную кнопку не занимаем — клиент показывает «Закрыть», и
   * навигация внутри приложения остаётся целиком нашей.
   */
  it("внутри Telegram рисует свою кнопку и не трогает нативную", () => {
    enterTelegram();
    const onBack = vi.fn();
    render(<ScreenBar title="Корзина" onBack={onBack} />);

    expect(back.show).not.toHaveBeenCalled();
    expect(back.onClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Назад" }));
    expect(onBack).toHaveBeenCalled();
  });

  // Каталог и карточка не размонтируются под экраном поверх них. Скрытый слой
  // выпадает из дерева доступности — иначе покупатель нашёл бы в каталоге
  // кнопку «назад» от карточки.
  it("на скрытом слое кнопки не найти", () => {
    render(
      <ScreenLayer hidden>
        <ScreenBar title="Товар" onBack={vi.fn()} />
      </ScreenLayer>,
    );

    expect(screen.queryByRole("button", { name: "Назад" })).toBeNull();
  });

  it("на показанном слое кнопка на месте", () => {
    render(
      <ScreenLayer hidden={false}>
        <ScreenBar title="Товар" onBack={vi.fn()} />
      </ScreenLayer>,
    );

    expect(screen.getByRole("button", { name: "Назад" })).toBeTruthy();
  });
});
