import { Icon, TabBar } from "@mikki-shop/ui";
import { useCart } from "../lib/cart";
import { navigate } from "../lib/route";
import type { Route } from "../lib/route";

/** Вкладка нижнего бара. Имя вкладки — это имя маршрута, отдельного ключа нет. */
type TabName = "home" | "catalog" | "cart" | "profile";

/**
 * Вкладки.
 *
 * Четыре, а не пять: «Заказы» живут внутри профиля, где для них уже есть
 * строка. Пятая вкладка ради экрана, куда заходят раз в неделю, отняла бы
 * ширину у тех, куда заходят каждый раз, — а в баре по правилам кита их и так
 * максимум пять.
 *
 * Профиль показан и гостю: бар — это постоянная часть интерфейса, и менять его
 * состав по факту входа значит перекладывать кнопки под пальцем. Гостю экран
 * профиля объясняет, что вход приходит из Telegram, — это лучше, чем вкладка,
 * которая то есть, то нет.
 */
const TABS: { key: TabName; label: string; icon: JSX.Element }[] = [
  { key: "home", label: "Главная", icon: <Icon name="home" /> },
  { key: "catalog", label: "Каталог", icon: <Icon name="grid-2x2" /> },
  { key: "cart", label: "Корзина", icon: <Icon name="shopping-bag" /> },
  { key: "profile", label: "Профиль", icon: <Icon name="user" /> },
];

/**
 * Маршрут вкладки.
 *
 * Разбором, а не приведением `{ name: key } as Route`: `Route` — размеченное
 * объединение, и приведение молча пропустило бы вкладку, для которой маршрута
 * нет. Здесь такую вкладку не соберётся тип.
 */
function routeOf(tab: TabName): Route {
  switch (tab) {
    case "home":
      return { name: "home" };
    case "catalog":
      return { name: "catalog" };
    case "cart":
      return { name: "cart" };
    case "profile":
      return { name: "profile" };
  }
}

/**
 * Нижний бар навигации.
 *
 * Ставится последним ребёнком экрана, а не поверх него: экраны — это колонки
 * во всю высоту с прокруткой посередине, и бар в конце такой колонки занимает
 * своё место сам. Ничего не перекрывает, и содержимому не нужно оставлять под
 * него запас.
 *
 * Полосу Telegram под кнопкой `MainButton` бар резервирует сам
 * (`reserveMainButton` в ките включён по умолчанию) — поэтому у экранов с
 * баром прокрутка заканчивается обычным отступом, а не `--safe-scroll-bottom`.
 */
export function AppTabs({ active }: { active: TabName }) {
  const cartCount = useCart((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0),
  );

  const items = TABS.map((tab) =>
    tab.key === "cart" && cartCount > 0 ? { ...tab, badge: cartCount } : tab,
  );

  return (
    <TabBar
      items={items}
      value={active}
      onChange={(key) => {
        // Нажатие по своей же вкладке — не переход: иначе каждое касание
        // клало бы в историю запись, из которой «назад» ведёт туда же.
        if (key === active) return;
        const tab = TABS.find((item) => item.key === key);
        // `replace`, а не новая запись: вкладки — это не путь вглубь, а один
        // и тот же уровень. Иначе история копила бы по записи на каждое
        // касание, и «назад» с профиля вело бы в корзину, оттуда в каталог,
        // и так далее — вместо того чтобы закрыть приложение. Переходы вглубь
        // (карточка, оформление, заказы) записи по-прежнему добавляют, поэтому
        // «назад» оттуда возвращает на ту вкладку, с которой ушли.
        if (tab) navigate(routeOf(tab.key), { replace: true });
      }}
    />
  );
}
