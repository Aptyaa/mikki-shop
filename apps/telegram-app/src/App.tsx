import { useRef } from "react";
import { ScreenLayer } from "./components/ScreenLayer";
import { useRoute } from "./lib/route";
import { useSession } from "./lib/session";
import { CartScreen } from "./screens/CartScreen";
import { CheckoutScreen } from "./screens/CheckoutScreen";
import { CatalogScreen } from "./screens/CatalogScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { OrdersScreen } from "./screens/OrdersScreen";
import { ProductScreen } from "./screens/ProductScreen";

/** Ключ каталога, открытого без категории: тот же псевдоключ, что и в фильтре. */
const ALL = "all";

/**
 * Старт, каталог и карточка не размонтируются, пока открыт другой экран:
 * иначе возврат назад сбрасывал бы у каталога категорию, поиск и подгруженные
 * страницы, у карточки — выбранный размер и расцветку, а у стартового экрана
 * прокрутку. Именно этот путь проходит покупатель: старт → каталог → карточка
 * → корзина → назад.
 *
 * Корзина размонтируется свободно: всё её состояние живёт в сторе.
 *
 * **Почему `useRef`, а не `useState` с присвоением во время рендера.** Раньше
 * последний слаг запоминался через `setLastSlug(...)` прямо в теле функции —
 * штатный приём React «поправить состояние при смене входных данных». Вместе с
 * `useSyncExternalStore`, на котором держится роутер, он даёт живой баг React 18
 * (`react@18.3.1`): render-phase-обновление рвёт подписку хука, и следующий
 * `hashchange` до компонента уже не доходит. На экране это выглядело так:
 * открыть карточку товара, нажать «назад» — адрес возвращается на каталог,
 * а на экране остаётся карточка, и второе «назад» выкидывает из приложения.
 *
 * Здесь это чистые «помню последнее увиденное»: перерисовку они вызывать не
 * должны — её уже вызвал сам роутер, — поэтому рефа достаточно, а подписка
 * остаётся целой. Значение выводится из текущего рендера и не меняется от
 * повторного вызова, так что двойной рендер StrictMode ничего не портит.
 */
export function App() {
  useSession();

  const route = useRoute();

  // Последний открытый товар, чтобы карточке было что показывать под корзиной.
  const lastSlug = useRef<string | undefined>(undefined);
  if (route.name === "product") lastSlug.current = route.slug;

  // Каталог монтируется не раньше первого захода в него: на старте он тянул бы
  // свою страницу выдачи в фоне за экраном, который её не показывает.
  const lastCatalog = useRef<string | null>(null);
  if (route.name === "catalog") lastCatalog.current = route.category ?? ALL;

  const slug = lastSlug.current;
  const catalogKey = lastCatalog.current;

  return (
    <>
      <ScreenLayer hidden={route.name !== "home"}>
        <HomeScreen />
      </ScreenLayer>

      {/* `key` по категории: выбор категории на старте — это новая выдача, а не
          та же с другим фильтром. Смена категории внутри самого каталога адрес
          не трогает, поэтому возврат из карточки его не перемонтирует. */}
      {catalogKey !== null && (
        <ScreenLayer hidden={route.name !== "catalog"}>
          <CatalogScreen
            key={catalogKey}
            initialCategory={catalogKey === ALL ? undefined : catalogKey}
          />
        </ScreenLayer>
      )}

      {/* `key` по слагу: переход с карточки на похожий товар — это новый экран,
          а не тот же с другими данными; иначе на нём остались бы выбранный
          размер, расцветка и прокрутка от предыдущего товара. */}
      {slug !== undefined && (
        <ScreenLayer hidden={route.name !== "product"}>
          <ProductScreen key={slug} slug={slug} />
        </ScreenLayer>
      )}

      {route.name === "cart" && <CartScreen />}
      {route.name === "checkout" && <CheckoutScreen />}
      {route.name === "orders" && <OrdersScreen />}
    </>
  );
}
