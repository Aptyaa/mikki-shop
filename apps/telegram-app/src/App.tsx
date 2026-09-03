import { useRoute } from "./lib/route";
import { CatalogScreen } from "./screens/CatalogScreen";
import { ProductScreen } from "./screens/ProductScreen";

/**
 * Каталог не размонтируется, пока открыта карточка: иначе возврат назад
 * сбрасывал бы категорию, поиск и все подгруженные страницы выдачи.
 *
 * Прячется он `visibility`, а не `display: none`: у скрытого через `display`
 * элемента браузер выбрасывает бокс прокрутки, и каталог возвращался бы к
 * началу списка. `position: fixed` при этом убирает его из потока, чтобы
 * карточка занимала экран целиком.
 */
const HIDDEN = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  visibility: "hidden",
  pointerEvents: "none",
} as const;

export function App() {
  const route = useRoute();
  const product = route.name === "product" ? route : undefined;

  return (
    <>
      <div style={product ? HIDDEN : undefined}>
        <CatalogScreen />
      </div>
      {/* `key` по слагу: переход с карточки на похожий товар — это новый экран,
          а не тот же с другими данными; иначе на нём остались бы выбранный
          размер, расцветка и прокрутка от предыдущего товара. */}
      {product && <ProductScreen key={product.slug} slug={product.slug} />}
    </>
  );
}
