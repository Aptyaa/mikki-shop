// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AppTabs } from "./AppTabs";
import { useCart } from "../lib/cart";

function tab(name: string): HTMLElement {
  return within(screen.getByRole("navigation")).getByRole("button", { name: new RegExp(name) });
}

beforeEach(() => {
  window.location.hash = "";
  window.localStorage.clear();
  useCart.setState({ items: [] });
});

afterEach(() => {
  cleanup();
});

describe("AppTabs", () => {
  it("показывает четыре вкладки", () => {
    render(<AppTabs active="home" />);

    for (const label of ["Главная", "Каталог", "Корзина", "Профиль"]) {
      expect(tab(label)).toBeTruthy();
    }
  });

  it("уводит на маршрут вкладки", () => {
    render(<AppTabs active="home" />);

    fireEvent.click(tab("Каталог"));
    expect(window.location.hash).toBe("#/catalog");

    fireEvent.click(tab("Профиль"));
    expect(window.location.hash).toBe("#/profile");
  });

  /**
   * Иначе каждое касание своей же вкладки клало бы в историю запись, из
   * которой «назад» ведёт ровно туда же.
   */
  it("нажатие по своей вкладке ничего не делает", () => {
    render(<AppTabs active="catalog" />);
    window.history.pushState({}, "", "#/catalog");
    const before = window.history.length;

    fireEvent.click(tab("Каталог"));

    expect(window.location.hash).toBe("#/catalog");
    expect(window.history.length).toBe(before);
  });

  /**
   * Вкладки — это один уровень, а не путь вглубь. Копили бы историю — «назад»
   * с профиля вело бы в корзину, оттуда в каталог, и так столько раз, сколько
   * человек трогал бар, вместо того чтобы закрыть приложение.
   */
  it("переключение вкладок не копит историю", () => {
    const { rerender } = render(<AppTabs active="home" />);
    const before = window.history.length;

    fireEvent.click(tab("Каталог"));
    rerender(<AppTabs active="catalog" />);
    fireEvent.click(tab("Корзина"));
    rerender(<AppTabs active="cart" />);
    fireEvent.click(tab("Профиль"));

    expect(window.location.hash).toBe("#/profile");
    expect(window.history.length).toBe(before);
  });

  it("помечает активную вкладку", () => {
    render(<AppTabs active="cart" />);

    // Активность в ките передаётся цветом и весом, а не атрибутом, поэтому
    // проверяется то, что видно: подпись активной вкладки жирнее.
    const weight = (label: string) =>
      getComputedStyle(within(tab(label)).getByText(label)).fontWeight;

    expect(weight("Корзина")).not.toBe(weight("Главная"));
  });

  it("показывает в корзине число товаров, а не позиций", () => {
    useCart.setState({
      items: [
        { slug: "a", size: "M", quantity: 2 },
        { slug: "b", size: "S", quantity: 3 },
      ],
    });
    render(<AppTabs active="home" />);

    expect(within(tab("Корзина")).getByText("5")).toBeTruthy();
  });

  it("на пустой корзине счётчика нет", () => {
    render(<AppTabs active="home" />);

    expect(within(tab("Корзина")).queryByText("0")).toBeNull();
  });
});
