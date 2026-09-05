// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ScreenBar } from "./ScreenBar";
import { ScreenLayer } from "./ScreenLayer";

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

/** Тот же скрипт, но в обычном браузере: объект есть, клиента нет. */
function browserWithScript() {
  window.Telegram = {
    WebApp: {
      initData: "",
      platform: "unknown",
      ready: vi.fn(),
      onEvent: vi.fn(),
      offEvent: vi.fn(),
      BackButton: back,
    } as never,
  };
}

beforeEach(() => {
  back.onClick.mockImplementation((handler: () => void) => {
    (back as unknown as { handler?: () => void }).handler = handler;
  });
});

afterEach(() => {
  cleanup();
  delete window.Telegram;
  vi.clearAllMocks();
});

describe("ScreenBar — Микки у заголовка", () => {
  it("ставит голову в заголовок, а знак по центру убирает", () => {
    const { container } = render(<ScreenBar title="Каталог" />);

    const images = [...container.querySelectorAll("img")];
    expect(images).toHaveLength(1);
    expect(images[0]?.getAttribute("src")).toContain("mascot-head");
  });

  /**
   * Слово разрезано на «Катало» и «г», чтобы голова цеплялась к последней
   * букве. Для скринридера и для глаз оно остаётся одним словом — дерево
   * доступности склеивает соседние строки.
   *
   * Ловушка для тестов: `getByText("Каталог")` на таком заголовке **не
   * сработает** — Testing Library сравнивает только прямые текстовые узлы
   * элемента, а их здесь два. Проверять надо весь текст шапки.
   */
  it("читается как одно слово, хоть и разрезан на два узла", () => {
    const { container } = render(<ScreenBar title="Каталог" />);

    expect(container.textContent).toBe("Каталог");
    expect(screen.queryByText("Каталог")).toBeNull();
    expect(screen.getByText("Катало")).toBeTruthy();
    expect(screen.getByText("г")).toBeTruthy();
  });

  // Голова — украшение рядом с текстом, который и так называет раздел.
  // «Микки Шоп» посреди заголовка скринридер читать не должен.
  it("голова не подмешивает своё имя в заголовок", () => {
    const { container } = render(<ScreenBar title="Каталог" />);

    const head = container.querySelector("img");
    expect(head).toHaveAttribute("alt", "");
    expect(head).toHaveAttribute("aria-hidden", "true");
    expect(container.textContent).toBe("Каталог");
  });

  /**
   * У карточки товара заголовка нет вовсе: длинное название категории наезжало
   * бы на знак. Цеплять голову там не к чему, и знак остаётся по центру полосы,
   * как было до этой правки.
   */
  it("без заголовка возвращает знак по центру", () => {
    const { container } = render(<ScreenBar />);

    const images = [...container.querySelectorAll("img")];
    expect(images).toHaveLength(1);
    expect(images[0]?.getAttribute("src")).toContain("mascot-mark");
  });

  it("пустой заголовок считает отсутствующим", () => {
    const { container } = render(<ScreenBar title="" />);

    expect(container.querySelector("img")?.getAttribute("src")).toContain("mascot-mark");
  });

  // Заголовок бывает и не строкой — разрезать на буквы можно только строку.
  it("нестроковый заголовок оставляет как есть", () => {
    const { container } = render(<ScreenBar title={<b>Готово</b>} />);

    expect(screen.getByText("Готово")).toBeTruthy();
    expect(container.querySelector("img")?.getAttribute("src")).toContain("mascot-mark");
  });
});

describe("ScreenBar вне Telegram", () => {
  it("рисует свою кнопку «назад»", () => {
    const onBack = vi.fn();
    render(<ScreenBar title="Корзина" onBack={onBack} />);

    fireEvent.click(screen.getByRole("button", { name: "Назад" }));

    expect(onBack).toHaveBeenCalled();
  });

  it("без onBack кнопки нет вовсе", () => {
    render(<ScreenBar title="Каталог" />);

    expect(screen.queryByRole("button", { name: "Назад" })).toBeNull();
  });
});

// Скрипт Telegram подключён в `index.html` безусловно и создаёт заглушки
// кнопок в любом браузере. Понадеявшись на них, шапка спрятала бы свою
// кнопку ради нативной, которой нет, — и уйти с карточки было бы нечем.
describe("ScreenBar в браузере со скриптом Telegram", () => {
  beforeEach(browserWithScript);

  it("рисует свою кнопку и не трогает заглушку клиента", () => {
    const onBack = vi.fn();
    render(<ScreenBar title="Корзина" onBack={onBack} />);

    expect(back.show).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Назад" }));
    expect(onBack).toHaveBeenCalled();
  });
});

describe("ScreenBar внутри Telegram", () => {
  beforeEach(enterTelegram);

  // Две кнопки «назад» рядом — это не забота, а вопрос «какая из них моя».
  it("отдаёт кнопку клиенту и свою не рисует", () => {
    const onBack = vi.fn();
    render(<ScreenBar title="Корзина" onBack={onBack} />);

    expect(back.show).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Назад" })).toBeNull();

    (back as unknown as { handler?: () => void }).handler?.();
    expect(onBack).toHaveBeenCalled();
  });

  it("отпускает кнопку, когда экран уходит", () => {
    const { unmount } = render(<ScreenBar title="Корзина" onBack={vi.fn()} />);

    unmount();

    expect(back.hide).toHaveBeenCalled();
    expect(back.offClick).toHaveBeenCalled();
  });

  it("без onBack кнопку не трогает", () => {
    render(<ScreenBar title="Каталог" />);

    expect(back.show).not.toHaveBeenCalled();
  });
});

describe("ScreenBar на скрытом слое", () => {
  beforeEach(enterTelegram);

  // Каталог и карточка не размонтируются под экраном поверх них. Без учёта
  // видимости кнопка «назад» карточки осталась бы висеть в каталоге —
  // ровно этот баг и нашёлся в браузере.
  it("не забирает кнопку, пока экран спрятан", () => {
    render(
      <ScreenLayer hidden>
        <ScreenBar title="Товар" onBack={vi.fn()} />
      </ScreenLayer>,
    );

    expect(back.show).not.toHaveBeenCalled();
  });

  it("забирает кнопку, когда экран показан", () => {
    render(
      <ScreenLayer hidden={false}>
        <ScreenBar title="Товар" onBack={vi.fn()} />
      </ScreenLayer>,
    );

    expect(back.show).toHaveBeenCalled();
  });

  it("отпускает кнопку, когда экран прячут", () => {
    const onBack = vi.fn();
    const { rerender } = render(
      <ScreenLayer hidden={false}>
        <ScreenBar title="Товар" onBack={onBack} />
      </ScreenLayer>,
    );

    rerender(
      <ScreenLayer hidden>
        <ScreenBar title="Товар" onBack={onBack} />
      </ScreenLayer>,
    );

    expect(back.hide).toHaveBeenCalled();
  });

  // Скрытый слой выпадает и из дерева доступности: своей кнопки на нём нет
  // ни для глаз, ни для скринридера, а нативную он не занимает. Иначе
  // покупатель нашёл бы в каталоге кнопку «назад» от карточки.
  it("на скрытом слое кнопки нет ни своей, ни нативной", () => {
    render(
      <ScreenLayer hidden>
        <ScreenBar title="Товар" onBack={vi.fn()} />
      </ScreenLayer>,
    );

    expect(back.show).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Назад" })).toBeNull();
  });
});
