import { useCallback, useEffect, useState } from "react";
import {
  AppBar,
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
import type {
  CatalogCategory,
  CatalogResponse,
  CatalogSize,
  CatalogSort,
} from "@mikki-shop/shared-types";
import { fetchCategories, fetchProducts } from "../api/catalog";
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

/** Каталог: главный экран Mini App. Раскладка повторяет ui_kits/telegram дизайн-системы. */
export function CatalogScreen() {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [category, setCategory] = useState(ALL.key);
  const [size, setSize] = useState<CatalogSize | undefined>(undefined);
  const [sort, setSort] = useState<CatalogSort>("pop");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [favourites, setFavourites] = useState<ReadonlySet<string>>(new Set<string>());
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    // Ошибку здесь не показываем отдельно: если API недоступен, об этом
    // скажет запрос товаров — два сообщения об одном сбое ни о чём не говорят.
    fetchCategories(controller.signal)
      .then(setCategories)
      .catch(() => undefined);
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchProducts({ category, size, sort, q: query }, controller.signal)
      .then((response) => {
        setData(response);
        setFailed(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [category, size, sort, query, attempt]);

  const toggleFavourite = useCallback((id: string) => {
    setFavourites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setCategory(ALL.key);
    setSize(undefined);
    setSearch("");
    setQuery("");
  }, []);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const sizes = data?.sizes ?? [];
  const available = data?.availableSizes ?? [];
  const unavailable = sizes.filter((value) => !available.includes(value));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh",
      maxWidth: "var(--content-max)", margin: "0 auto", background: "var(--bg-page)" }}>
      <AppBar
        title="Каталог"
        subtitle={data ? models(total) : undefined}
        right={
          <div style={{ display: "flex", gap: "var(--sp-2)" }}>
            <IconButton label="Поиск" active={searchOpen} onClick={() => setSearchOpen((open) => !open)}>
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
        padding: "var(--sp-5) var(--gutter) var(--safe-scroll-bottom)" }}>
        {failed ? (
          <Notice tone="danger" title="Каталог не загрузился">
            Проверьте соединение и попробуйте снова.
            <div style={{ marginTop: "var(--sp-4)" }}>
              <Button variant="outline" size="sm" onClick={() => setAttempt((value) => value + 1)}>
                Повторить
              </Button>
            </div>
          </Notice>
        ) : loading && !data ? (
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
              opacity: loading ? 0.6 : 1, transition: "opacity var(--dur-fast) var(--ease-out)" }}>
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
              <span>Показано {items.length} из {total}</span>
            </Band>
          </>
        )}
      </div>

      <Sheet
        open={filtersOpen}
        title="Фильтры"
        onClose={() => setFiltersOpen(false)}
        footer={
          <Button block onClick={() => setFiltersOpen(false)}>
            Показать {models(items.length)}
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
    </div>
  );
}
