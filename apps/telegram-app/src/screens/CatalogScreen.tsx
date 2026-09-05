import { useCallback, useEffect, useState } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  Band,
  Button,
  Divider,
  Dot,
  EmptyState,
  Icon,
  IconButton,
  Input,
  Notice,
  ProductCard,
  RadioTile,
  Sheet,
  SizeSelector,
  Skeleton,
} from "@mikki-shop/ui";
import type { CatalogSize, CatalogSort } from "@mikki-shop/shared-types";
import { fetchCategories, fetchProducts } from "../api/catalog";
import { AppTabs } from "../components/AppTabs";
import { ScreenBar } from "../components/ScreenBar";
import { goBack, navigate } from "../lib/route";
import { plural } from "../lib/plural";

const SORTS: { key: CatalogSort; label: string }[] = [
  { key: "pop", label: "Популярные" },
  { key: "new", label: "Новые" },
  { key: "cheap", label: "Сначала дешёвые" },
];

const ALL = { key: "all", label: "Всё" };

const models = (count: number) => `${count} ${plural(count, "модель", "модели", "моделей")}`;

/** Сетка-заглушка на первую загрузку: повторяет реальную раскладку плиток. */
function SkeletonGrid() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
      columnGap: "var(--grid-gap)", rowGap: "var(--grid-gap-row)" }}>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <Skeleton style={{ width: "100%", aspectRatio: "4 / 5", height: "auto" }} radius="var(--r-image)" />
          <Skeleton height={13} width="85%" />
          <Skeleton height={15} width="45%" />
        </div>
      ))}
    </div>
  );
}

interface CatalogScreenProps {
  /**
   * Категория, с которой каталог открывается: ключ из адреса
   * (`#/catalog?category=sweaters`), когда в каталог пришли по конкретной
   * категории со стартового экрана. Дальше фильтр живёт в экране: адрес
   * его не переписывает, чтобы возврат из карточки не сбрасывал выбор.
   */
  initialCategory?: string;
}

/** Каталог: экран выдачи. Раскладка повторяет ui_kits/telegram дизайн-системы. */
export function CatalogScreen({ initialCategory }: CatalogScreenProps = {}) {
  const [category, setCategory] = useState(initialCategory ?? ALL.key);
  const [size, setSize] = useState<CatalogSize | undefined>(undefined);
  const [sort, setSort] = useState<CatalogSort>("pop");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [favourites, setFavourites] = useState<ReadonlySet<string>>(new Set<string>());

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Ошибку категорий отдельно не показываем: если API недоступен, об этом
  // скажет запрос товаров — два сообщения об одном сбое ни о чём не говорят.
  const categoriesQuery = useQuery({
    queryKey: ["catalog", "categories"],
    queryFn: ({ signal }) => fetchCategories(signal),
  });

  const productsQuery = useInfiniteQuery({
    queryKey: ["catalog", "products", { category, size, sort, q: query }],
    queryFn: ({ pageParam, signal }) =>
      fetchProducts({ category, size, sort, q: query, offset: pageParam }, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => {
      const loaded = last.offset + last.items.length;
      return loaded < last.matched ? loaded : undefined;
    },
    // Смена фильтра не роняет список в скелет: старая выдача гаснет и заменяется.
    placeholderData: keepPreviousData,
  });

  const toggleFavourite = useCallback((id: string) => {
    setFavourites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSearch = useCallback(() => {
    setSearch("");
    setQuery("");
  }, []);

  // Сворачивание поиска чистит запрос: иначе поле спрятано, а выдача осталась
  // отфильтрованной, и на экране ничто этого не объясняет.
  const toggleSearch = useCallback(() => {
    if (searchOpen) clearSearch();
    setSearchOpen((open) => !open);
  }, [searchOpen, clearSearch]);

  const resetFilters = useCallback(() => {
    setCategory(ALL.key);
    setSize(undefined);
    clearSearch();
  }, [clearSearch]);

  const pages = productsQuery.data?.pages ?? [];
  const head = pages[0];
  const items = pages.flatMap((page) => page.items);
  const matched = head?.matched ?? 0;
  const total = head?.total ?? 0;
  const sizes = head?.sizes ?? [];
  const available = head?.availableSizes ?? [];
  // Выбранный размер не помечаем недоступным, даже если в новой категории его
  // нет: `SizeSelector` рисует такие кнопки `disabled`, и снять фильтр стало бы
  // нечем — выдача пустая, а размер не отжимается.
  const unavailable = sizes.filter((value) => !available.includes(value) && value !== size);
  const categories = categoriesQuery.data ?? [];
  const refreshing = productsQuery.isFetching && !productsQuery.isFetchingNextPage;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh",
      maxWidth: "var(--content-max)", margin: "0 auto", background: "var(--bg-page)" }}>
      <ScreenBar
        title="Каталог"
        subtitle={head ? models(total) : undefined}
        onBack={goBack}
        right={
          <div style={{ display: "flex", gap: "var(--sp-2)" }}>
            <IconButton label="Поиск" active={searchOpen} onClick={toggleSearch}>
              <Icon name="search" />
            </IconButton>
            <IconButton label="Фильтры" onClick={() => setFiltersOpen(true)}>
              <Icon name="sliders-horizontal" />
            </IconButton>
          </div>
        }
      />

      {searchOpen && (
        <div style={{ flexShrink: 0, padding: "var(--sp-4) var(--gutter)",
          borderBottom: "1px solid var(--border-subtle)" }}>
          <Input
            placeholder="Свитер, дождевик, бандана"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            iconLeft={<Icon name="search" size={18} />}
            iconRight={
              search ? (
                // Крестик очищает сразу, не дожидаясь дебаунса: пустой запрос
                // и так вернёт весь каталог, ждать 300 мс не за чем.
                <button
                  type="button"
                  aria-label="Очистить поиск"
                  onClick={clearSearch}
                  style={{ display: "grid", placeItems: "center", width: "var(--tap-min)",
                    height: "var(--tap-min)", margin: "0 calc(var(--field-pad-x) * -1) 0 0",
                    padding: 0, border: "none", background: "none", cursor: "pointer",
                    color: "var(--text-muted)" }}
                >
                  <Icon name="x" size={18} />
                </button>
              ) : null
            }
          />
        </div>
      )}

      {/* Категории — текстовый ряд, а не пилюли: так это устроено в ките. */}
      <div style={{ flexShrink: 0, display: "flex", gap: "var(--sp-6)", overflowX: "auto",
        padding: "var(--sp-4) var(--gutter)", borderBottom: "1px solid var(--border-subtle)",
        scrollbarWidth: "none" }}>
        {[ALL, ...categories].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setCategory(item.key)}
            style={{ border: "none", background: "none", padding: 0, cursor: "pointer",
              whiteSpace: "nowrap", fontFamily: "var(--font-body)", fontSize: "var(--fs-body-sm)",
              fontWeight: category === item.key ? "var(--fw-semibold)" : "var(--fw-regular)",
              color: category === item.key ? "var(--text-heading)" : "var(--text-muted)" }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto",
        padding: "var(--sp-5) var(--gutter) var(--sp-6)" }}>
        {productsQuery.isError ? (
          <Notice tone="danger" title="Каталог не загрузился">
            Проверьте соединение и попробуйте снова.
            <div style={{ marginTop: "var(--sp-4)" }}>
              <Button variant="outline" size="sm" onClick={() => productsQuery.refetch()}>
                Повторить
              </Button>
            </div>
          </Notice>
        ) : productsQuery.isPending ? (
          <SkeletonGrid />
        ) : items.length === 0 ? (
          <EmptyState
            title="Ничего не нашлось"
            body="Попробуйте другой размер или категорию."
            action={<Button variant="outline" onClick={resetFilters}>Сбросить фильтры</Button>}
          />
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
              columnGap: "var(--grid-gap)", rowGap: "var(--grid-gap-row)",
              opacity: refreshing ? 0.6 : 1, transition: "opacity var(--dur-fast) var(--ease-out)" }}>
              {items.map((product) => (
                <ProductCard
                  key={product.id}
                  title={product.title}
                  price={product.price}
                  was={product.was}
                  tag={product.tag}
                  tagTone={product.tagTone}
                  soldOut={product.soldOut}
                  favourite={favourites.has(product.id)}
                  onFavourite={() => toggleFavourite(product.id)}
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

            <Band tone="paper" align="center" style={{ marginTop: "var(--sp-7)" }}>
              <span>Показано {items.length} из {matched}</span>
            </Band>

            {productsQuery.hasNextPage && (
              <Button
                block
                variant="outline"
                loading={productsQuery.isFetchingNextPage}
                onClick={() => productsQuery.fetchNextPage()}
                style={{ marginTop: "var(--sp-5)" }}
              >
                Показать ещё {Math.min(head?.limit ?? 0, matched - items.length)}
              </Button>
            )}
          </>
        )}
      </div>

      <Sheet
        open={filtersOpen}
        title="Фильтры"
        onClose={() => setFiltersOpen(false)}
        footer={
          <Button block onClick={() => setFiltersOpen(false)}>
            Показать {models(matched)}
          </Button>
        }
      >
        <div className="ms-eyebrow" style={{ marginBottom: "var(--sp-3)" }}>размер питомца</div>
        <SizeSelector
          sizes={sizes}
          value={size}
          unavailable={unavailable}
          onChange={(next) => setSize((current) => (current === next ? undefined : (next as CatalogSize)))}
        />

        <Divider style={{ margin: "var(--sp-6) 0" }} />

        <div className="ms-eyebrow" style={{ marginBottom: "var(--sp-3)" }}>сортировка</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          {SORTS.map((option) => (
            <RadioTile
              key={option.key}
              selected={sort === option.key}
              title={option.label}
              onClick={() => setSort(option.key)}
            />
          ))}
        </div>
      </Sheet>

      <AppTabs active="catalog" />
    </div>
  );
}
