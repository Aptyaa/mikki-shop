import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AppBar,
  Badge,
  Band,
  Button,
  Card,
  Chip,
  Divider,
  Dot,
  Icon,
  IconButton,
  Logo,
  Notice,
  ProductCard,
  SectionHeader,
  Skeleton,
} from "@mikki-shop/ui";
import { fetchCategories, fetchProducts } from "../api/catalog";
import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart";
import { introCollapsed, rememberIntroCollapsed } from "../lib/onboarding";
import { plural } from "../lib/plural";
import { navigate } from "../lib/route";

/** Сколько новинок показывать: ровно два ряда сетки, дальше — в каталог. */
const NEW_LIMIT = 4;

const models = (count: number) => `${count} ${plural(count, "модель", "модели", "моделей")}`;

/**
 * Онбординг: три шага пути покупателя.
 *
 * Здесь описано то, что в приложении действительно есть, а не то, что хотелось
 * бы обещать. Особенно третий шаг: оплаты в Mini App нет до фазы 2, и узнать об
 * этом на кнопке «Оформить заказ» — худший момент из возможных.
 */
const STEPS = [
  {
    title: "Снимите мерки",
    body: "Обхват груди, шеи и длина спины. В карточке товара есть таблица размеров с мерками под каждый — размер выбирается по ним, а не на глаз.",
  },
  {
    title: "Соберите заказ",
    body: "Корзина помнит выбор, даже если закрыть приложение. Цены и наличие пересчитываются при каждом открытии — по каталогу, а не по тому, что запомнилось.",
  },
  {
    title: "Менеджер подтвердит",
    body: "Оплаты в приложении пока нет: заказ уходит заявкой, менеджер пишет в Telegram и согласует состав и доставку.",
  },
];

/** Заглушка новинок на первую загрузку: повторяет реальную раскладку плиток. */
function SkeletonRow() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
      columnGap: "var(--grid-gap)", rowGap: "var(--grid-gap-row)" }}>
      {Array.from({ length: NEW_LIMIT }, (_, index) => (
        <div key={index} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <Skeleton style={{ width: "100%", aspectRatio: "4 / 5", height: "auto" }} radius="var(--r-image)" />
          <Skeleton height={13} width="85%" />
          <Skeleton height={15} width="45%" />
        </div>
      ))}
    </div>
  );
}

/**
 * Стартовый экран Mini App: витрина плюс онбординг.
 *
 * Каталог стоял на корне и открывался сеткой плиток человеку, который пришёл
 * из ролика в TikTok и не знает ни магазина, ни того, что заказ здесь — заявка
 * менеджеру, а не оплата. Этот экран отвечает на оба вопроса до того, как их
 * зададут, и уводит в каталог кнопкой.
 */
export function HomeScreen() {
  // Начальное значение читается один раз при монтировании: перечитывать
  // хранилище на каждый рендер незачем, менять его отсюда больше некому.
  const [collapsed, setCollapsed] = useState(introCollapsed);

  const cartCount = useCart((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0),
  );
  const signedIn = useAuth((state) => state.token !== null);
  const firstName = useAuth((state) => state.user?.firstName);

  const categoriesQuery = useQuery({
    // Тот же ключ, что у каталога: категории одни и те же, и второй запрос за
    // ними при переходе со старта в каталог был бы лишним.
    queryKey: ["catalog", "categories"],
    queryFn: ({ signal }) => fetchCategories(signal),
  });

  const freshQuery = useQuery({
    queryKey: ["home", "new", NEW_LIMIT],
    queryFn: ({ signal }) => fetchProducts({ sort: "new", limit: NEW_LIMIT }, signal),
  });

  // Запись в хранилище стоит рядом с `setState`, а не внутри его функции
  // обновления: та обязана быть чистой и в StrictMode вызывается дважды.
  const toggleIntro = () => {
    const next = !collapsed;
    setCollapsed(next);
    rememberIntroCollapsed(next);
  };

  const categories = categoriesQuery.data ?? [];
  const fresh = freshQuery.data;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh",
      maxWidth: "var(--content-max)", margin: "0 auto", background: "var(--bg-page)" }}>
      {/* Шапка без `ScreenBar`: тот ставит знак Микки в центр полосы, а здесь
          маскот и так стоит в лого под ней — два Микки в один экран не лезут. */}
      <AppBar
        right={
          <div style={{ display: "flex", gap: "var(--sp-2)" }}>
            <IconButton label="Поиск по каталогу" onClick={() => navigate({ name: "catalog" })}>
              <Icon name="search" />
            </IconButton>
            {signedIn && (
              <IconButton label="Мои заказы" onClick={() => navigate({ name: "orders" })}>
                <Icon name="package" />
              </IconButton>
            )}
            <IconButton
              label="Корзина"
              onClick={() => navigate({ name: "cart" })}
              style={{ position: "relative" }}
            >
              <Icon name="shopping-bag" />
              {cartCount > 0 && (
                <span style={{ position: "absolute", top: 2, right: 2 }}>
                  <Badge count={cartCount} />
                </span>
              )}
            </IconButton>
          </div>
        }
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto",
        padding: "var(--sp-7) var(--gutter) var(--safe-scroll-bottom)" }}>
        {/* Витринная компоновка знака: маскот сидит на вордмарке. Она просит
            вертикального места и спокойного фона — ровно то, что здесь есть,
            и ровно там, где дизайн-система разрешает её ставить. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
          textAlign: "center", gap: "var(--sp-5)" }}>
          <Logo variant="perched" size="lg" />

          <h1 style={{ margin: 0, fontFamily: "var(--font-display)",
            fontWeight: "var(--fw-extrabold)", fontSize: "var(--fs-h1)",
            lineHeight: "var(--lh-h1)", letterSpacing: "var(--ls-h1)",
            color: "var(--text-heading)" }}>
            {firstName ? `Привет, ${firstName}` : "Одежда для маленьких собак"}
          </h1>

          <p style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: "var(--lh-body)",
            color: "var(--text-body)" }}>
            Свитеры, дождевики и банданы для собак, которым не подходит ни один детский
            размер. Мерки груди, шеи и спины — в каждой карточке.
          </p>

          <Button
            size="lg"
            block
            iconRight={<Icon name="chevron-right" size={18} />}
            onClick={() => navigate({ name: "catalog" })}
          >
            Смотреть каталог
          </Button>
        </div>

        {/* Единственная жёлтая полоса экрана, и в ней число, а не обещание:
            сколько моделей в каталоге — это то, что мы знаем наверняка. */}
        {fresh && (
          <Band tone="butter" align="between" style={{ marginTop: "var(--sp-8)" }}>
            <span>В каталоге</span>
            <span>{models(fresh.total)}</span>
          </Band>
        )}

        <section style={{ marginTop: "var(--section-gap)" }}>
          <Card tone="plain" pad="none">
            <button
              type="button"
              onClick={toggleIntro}
              aria-expanded={!collapsed}
              aria-controls="ms-intro-steps"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: "var(--sp-4)", width: "100%", minHeight: "var(--tap-min)", padding: 0,
                border: "none", background: "none", cursor: "pointer", textAlign: "left" }}
            >
              <span style={{ fontFamily: "var(--font-display)",
                fontWeight: "var(--fw-extrabold)", fontSize: "var(--fs-h2)",
                lineHeight: "var(--lh-h2)", letterSpacing: "var(--ls-h2)",
                color: "var(--text-heading)" }}>
                Как это работает
              </span>
              <Icon
                name="chevron-down"
                color="var(--text-muted)"
                style={{ transform: collapsed ? "rotate(-90deg)" : undefined,
                  transition: "transform var(--dur-base) var(--ease-out)" }}
              />
            </button>

            {!collapsed && (
              <div id="ms-intro-steps" style={{ marginTop: "var(--sp-5)" }}>
                {STEPS.map((step, index) => (
                  <div key={step.title}>
                    {index > 0 && <Divider style={{ margin: "var(--sp-5) 0" }} />}
                    <div style={{ display: "flex", gap: "var(--sp-5)", alignItems: "flex-start" }}>
                      {/* Номер набран дисплейной гарнитурой без кружка: круг
                          в этой системе оставлен счётчикам и диску маскота. */}
                      <span style={{ flexShrink: 0, minWidth: "var(--sp-6)",
                        fontFamily: "var(--font-display)", fontWeight: "var(--fw-extrabold)",
                        fontSize: "var(--fs-h2)", lineHeight: "var(--lh-h2)",
                        color: "var(--ornament)" }}>
                        {index + 1}
                      </span>
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
                        <span style={{ fontFamily: "var(--font-display)",
                          fontWeight: "var(--fw-bold)", fontSize: "var(--fs-h3)",
                          lineHeight: "var(--lh-h3)", color: "var(--text-heading)" }}>
                          {step.title}
                        </span>
                        <span style={{ fontSize: "var(--fs-body-sm)",
                          lineHeight: "var(--lh-body-sm)", color: "var(--text-body)" }}>
                          {step.body}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>

        {/* Ошибку категорий отдельно не показываем — как и в каталоге: если API
            недоступен, об этом скажет блок новинок, а два сообщения об одном
            сбое ни о чём не говорят. */}
        {categories.length > 0 && (
          <section style={{ marginTop: "var(--section-gap)" }}>
            <SectionHeader
              title="Категории"
              action="всё →"
              onAction={() => navigate({ name: "catalog" })}
            />
            {/* Скроллер уходит под края экрана: отрицательный гаттер плюс
                равное ему внутреннее поле, чтобы первая и последняя пилюля
                не липли к краю. */}
            <div style={{ display: "flex", gap: "var(--sp-3)", overflowX: "auto",
              margin: "0 calc(var(--gutter) * -1)", padding: "0 var(--gutter)",
              scrollbarWidth: "none" }}>
              {categories.map((category) => (
                <Chip
                  key={category.key}
                  count={category.count}
                  onClick={() => navigate({ name: "catalog", category: category.key })}
                >
                  {category.label}
                </Chip>
              ))}
            </div>
          </section>
        )}

        <section style={{ marginTop: "var(--section-gap)" }}>
          <SectionHeader
            title="Новинки"
            subtitle="Что приехало последним"
            action="в каталог →"
            onAction={() => navigate({ name: "catalog" })}
          />

          {freshQuery.isError ? (
            <Notice tone="danger" title="Новинки не загрузились">
              Проверьте соединение и попробуйте снова.
              <div style={{ marginTop: "var(--sp-4)" }}>
                <Button variant="outline" size="sm" onClick={() => freshQuery.refetch()}>
                  Повторить
                </Button>
              </div>
            </Notice>
          ) : freshQuery.isPending ? (
            <SkeletonRow />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
              columnGap: "var(--grid-gap)", rowGap: "var(--grid-gap-row)" }}>
              {fresh?.items.map((product) => (
                // Сердечка здесь нет намеренно: избранное в каталоге живёт в
                // локальном состоянии экрана и не переживает перезагрузку —
                // второе такое же место множило бы состояние, которого нет.
                <ProductCard
                  key={product.id}
                  title={product.title}
                  price={product.price}
                  was={product.was}
                  tag={product.tag}
                  tagTone={product.tagTone}
                  soldOut={product.soldOut}
                  onClick={() => navigate({ name: "product", slug: product.slug })}
                  sizes={
                    product.soldOut ? undefined
                      : product.stockNote
                        ? <><Dot />{product.stockNote}</>
                        : product.sizes.join(" · ")
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
