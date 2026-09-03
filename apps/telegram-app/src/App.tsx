import { useState } from "react";
import type { ReactNode } from "react";
import { useRoute } from "./lib/route";
import { CartScreen } from "./screens/CartScreen";
import { CatalogScreen } from "./screens/CatalogScreen";
import { ProductScreen } from "./screens/ProductScreen";

/**
 * Спрятанный слой экрана.
 *
 * `visibility`, а не `display: none`: у скрытого через `display` элемента
 * браузер выбрасывает бокс прокрутки, и экран возвращался бы к началу.
 * `position: fixed` при этом убирает его из потока, чтобы верхний экран
 * занимал вьюпорт целиком.
 */
const HIDDEN = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  visibility: "hidden",
  pointerEvents: "none",
} as const;

function Layer({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  return <div style={hidden ? HIDDEN : undefined}>{children}</div>;
}

/**
 * Каталог и карточка не размонтируются, пока открыт другой экран: иначе
 * возврат назад сбрасывал бы у каталога категорию, поиск и подгруженные
 * страницы, а у карточки — выбранный размер и расцветку. Именно этот путь
 * проходит покупатель: карточка → корзина → назад к карточке.
 *
 * Корзина размонтируется свободно: всё её состояние живёт в сторе.
 */
export function App() {
  const route = useRoute();
  const slug = route.name === "product" ? route.slug : undefined;

  // Последний открытый товар, чтобы карточку было что показывать под корзиной.
  const [lastSlug, setLastSlug] = useState(slug);
  if (slug !== undefined && slug !== lastSlug) setLastSlug(slug);

  return (
    <>
      <Layer hidden={route.name !== "catalog"}>
        <CatalogScreen />
      </Layer>

      {/* `key` по слагу: переход с карточки на похожий товар — это новый экран,
          а не тот же с другими данными; иначе на нём остались бы выбранный
          размер, расцветка и прокрутка от предыдущего товара. */}
      {lastSlug !== undefined && (
        <Layer hidden={route.name !== "product"}>
          <ProductScreen key={lastSlug} slug={lastSlug} />
        </Layer>
      )}

      {route.name === "cart" && <CartScreen />}
    </>
  );
}
