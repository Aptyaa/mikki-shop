import { useState } from "react";
import { ScreenLayer } from "./components/ScreenLayer";
import { useRoute } from "./lib/route";
import { useSession } from "./lib/session";
import { CartScreen } from "./screens/CartScreen";
import { CatalogScreen } from "./screens/CatalogScreen";
import { ProductScreen } from "./screens/ProductScreen";

/**
 * Каталог и карточка не размонтируются, пока открыт другой экран: иначе
 * возврат назад сбрасывал бы у каталога категорию, поиск и подгруженные
 * страницы, а у карточки — выбранный размер и расцветку. Именно этот путь
 * проходит покупатель: карточка → корзина → назад к карточке.
 *
 * Корзина размонтируется свободно: всё её состояние живёт в сторе.
 */
export function App() {
  useSession();

  const route = useRoute();
  const slug = route.name === "product" ? route.slug : undefined;

  // Последний открытый товар, чтобы карточке было что показывать под корзиной.
  const [lastSlug, setLastSlug] = useState(slug);
  if (slug !== undefined && slug !== lastSlug) setLastSlug(slug);

  return (
    <>
      <ScreenLayer hidden={route.name !== "catalog"}>
        <CatalogScreen />
      </ScreenLayer>

      {/* `key` по слагу: переход с карточки на похожий товар — это новый экран,
          а не тот же с другими данными; иначе на нём остались бы выбранный
          размер, расцветка и прокрутка от предыдущего товара. */}
      {lastSlug !== undefined && (
        <ScreenLayer hidden={route.name !== "product"}>
          <ProductScreen key={lastSlug} slug={lastSlug} />
        </ScreenLayer>
      )}

      {route.name === "cart" && <CartScreen />}
    </>
  );
}
