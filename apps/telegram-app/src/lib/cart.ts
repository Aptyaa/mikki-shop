import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItemInput, CatalogSize } from "@mikki-shop/shared-types";

/**
 * Корзина — первое состояние, которое переживает переход между экранами и
 * должно быть видно одновременно в шапке каталога, на карточке товара и на
 * своём экране. Ровно тот критерий, по которому в `ARCHITECTURE.md` заведение
 * Zustand было отложено до этого момента.
 *
 * В сторе лежат только «что выбрали»: слаг, размер, расцветка, количество.
 * Названия, цены и наличие приходят с бэкенда (`POST /cart/preview`) — иначе в
 * корзине стояла бы цена недельной давности из `localStorage`.
 */
export interface CartItem {
  slug: string;
  size: CatalogSize;
  color?: string;
  quantity: number;
}

/**
 * Мягкий предел количества в одной строке.
 *
 * Жёсткий предел — на бэкенде (`apps/api/src/cart/cart.constants.ts`), здесь
 * копия, потому что в `shared-types` нельзя класть значения: пакет собирается
 * в CommonJS ради NestJS, и первая же рантайм-константа в нём ломает
 * ESM-импорт из Vite (см. `docs/features/001-catalog-screen.md`).
 *
 * Расхождение двух чисел не даёт бага: сервер всё равно пересчитает по своему
 * пределу и вернёт `maxQuantity`, а `clampToStock` приведёт к нему корзину.
 * Больше своего сервер не отдаст, меньше — покупатель просто не наберёт.
 */
export const CART_LINE_MAX = 10;

/** Ключ позиции: один товар в разных размерах и расцветках — разные строки. */
export function cartKey(item: Pick<CartItem, "slug" | "size" | "color">): string {
  return `${item.slug} ${item.size} ${item.color ?? ""}`;
}

interface CartState {
  items: CartItem[];
  /** Добавить, сложив с такой же позицией, если она уже в корзине. */
  add: (item: CartItem) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  /** Выкинуть позиции, которых больше нет в каталоге, — по ответу бэкенда. */
  dropMissing: (slugs: string[]) => void;
  /** Привести количества к тому, что осталось на складе. Ключ → максимум. */
  clampToStock: (limits: Record<string, number>) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],

      add: (item) =>
        set((state) => {
          const key = cartKey(item);
          const existing = state.items.find((current) => cartKey(current) === key);
          if (!existing) return { items: [...state.items, item] };

          return {
            items: state.items.map((current) =>
              cartKey(current) === key
                ? { ...current, quantity: Math.min(current.quantity + item.quantity, CART_LINE_MAX) }
                : current,
            ),
          };
        }),

      setQuantity: (key, quantity) =>
        set((state) => ({
          // Ноль убирает позицию: степпер и так не опускается ниже единицы,
          // но состояние не должно уметь хранить строку «ноль штук».
          items:
            quantity < 1
              ? state.items.filter((item) => cartKey(item) !== key)
              : state.items.map((item) =>
                  cartKey(item) === key
                    ? { ...item, quantity: Math.min(quantity, CART_LINE_MAX) }
                    : item,
                ),
        })),

      remove: (key) =>
        set((state) => ({ items: state.items.filter((item) => cartKey(item) !== key) })),

      dropMissing: (slugs) =>
        set((state) => ({ items: state.items.filter((item) => !slugs.includes(item.slug)) })),

      // Позиции с нулевым остатком не трогаем: молча удалить строку из корзины
      // хуже, чем показать её с пометкой «этого размера нет» и дать убрать самому.
      clampToStock: (limits) =>
        set((state) => ({
          items: state.items.map((item) => {
            const limit = limits[cartKey(item)];
            return limit != null && limit > 0 && item.quantity > limit
              ? { ...item, quantity: limit }
              : item;
          }),
        })),

      clear: () => set({ items: [] }),
    }),
    {
      name: "mikki-cart",
      // Версия нужна на будущее: изменится форма позиции — старую корзину из
      // localStorage надо будет либо смигрировать, либо честно выкинуть.
      version: 1,
    },
  ),
);

/** Позиции в виде, в котором их ждёт бэкенд. */
export function toCartInput(items: CartItem[]): CartItemInput[] {
  return items.map((item) => ({
    slug: item.slug,
    size: item.size,
    ...(item.color ? { color: item.color } : {}),
    quantity: item.quantity,
  }));
}
