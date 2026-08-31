import React from "react";
import {
  AppBar,
  SectionHeader,
  TabBar,
  Band,
  Chip,
  IconButton,
  Badge,
  Dot,
  Icon,
  ProductCard,
  EmptyState,
} from "@mikki-shop/ui";

const DEFAULT_CATEGORIES = [
  { key: "all", label: "Все" },
  { key: "sweaters", label: "Свитера" },
  { key: "raincoats", label: "Дождевики" },
  { key: "overalls", label: "Комбинезоны" },
  { key: "accessories", label: "Аксессуары" },
];

const DEFAULT_PRODUCTS = [
  { id: "p1", category: "sweaters", title: "Вязаный свитер «Сахарок»", price: 1490, was: 2190, tag: "−30%", tagTone: "sale", sizes: "XS · S · M", favourite: true },
  { id: "p2", category: "raincoats", title: "Дождевик «Лужа» с капюшоном", price: 1990, tag: "новинка", tagTone: "new", sizes: "S · M · L" },
  { id: "p3", category: "overalls", title: "Комбинезон «Плюшка» на флисе", price: 2390, sizes: "XS · S" },
  { id: "p4", category: "accessories", title: "Шлейка «Ромашка»", price: 990, sizes: "S · M" },
  { id: "p5", category: "sweaters", title: "Свитер «Овсянка» в резинку", price: 1690, soldOut: true, sizes: "M · L" },
  { id: "p6", category: "raincoats", title: "Дождевик «Морось» без капюшона", price: 1590, was: 1990, tag: "−20%", tagTone: "sale", sizes: "XS · S · M" },
];

const TAB_ITEMS = [
  { key: "catalog", label: "Каталог", icon: <Icon name="grid-2x2" size={20} /> },
  { key: "favourites", label: "Избранное", icon: <Icon name="heart" size={20} /> },
  { key: "cart", label: "Корзина", icon: <Icon name="shopping-bag" size={20} /> },
  { key: "profile", label: "Профиль", icon: <Icon name="user" size={20} /> },
];

/** Каталог: главный экран Mini App. Полосы жёлтая — одна, сетка ProductCard — две плитки в ряд. */
export function CatalogScreen({
  products = DEFAULT_PRODUCTS,
  categories = DEFAULT_CATEGORIES,
  activeCategory = "all",
  onCategoryChange,
  favourites = new Set(["p1"]),
  onFavourite,
  onProductClick,
  cartCount = 2,
  activeTab = "catalog",
  onTabChange,
  onSearch,
  onCartClick,
  style,
  ...rest
}) {
  const visible = activeCategory === "all" ? products : products.filter((p) => p.category === activeCategory);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        maxWidth: "var(--content-max)",
        margin: "0 auto",
        background: "var(--bg-page)",
        ...style,
      }}
      {...rest}
    >
      <AppBar
        right={
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
            <IconButton label="Поиск" onClick={onSearch}>
              <Icon name="search" size={20} />
            </IconButton>
            <IconButton label="Корзина" onClick={onCartClick} style={{ position: "relative" }}>
              <Icon name="shopping-bag" size={20} />
              {cartCount > 0 && (
                <Badge count={cartCount} style={{ position: "absolute", top: 2, right: 2 }} />
              )}
            </IconButton>
          </div>
        }
      />

      <div style={{ flex: 1, padding: "var(--sp-6) var(--gutter) var(--safe-scroll-bottom)" }}>
        <Band tone="butter" style={{ marginBottom: "var(--section-gap)" }}>
          <span>Бесплатная доставка от 3 000 ₽</span>
          <Icon name="truck" size={18} />
        </Band>

        <SectionHeader title="Каталог" subtitle={`${visible.length} товара`} />

        <div
          style={{
            display: "flex",
            gap: "var(--sp-3)",
            overflowX: "auto",
            marginLeft: "calc(var(--gutter) * -1)",
            marginRight: "calc(var(--gutter) * -1)",
            padding: "0 var(--gutter) var(--sp-5)",
          }}
        >
          {categories.map((c) => (
            <Chip
              key={c.key}
              selected={activeCategory === c.key}
              onClick={() => onCategoryChange && onCategoryChange(c.key)}
              style={{ flexShrink: 0 }}
            >
              {c.label}
            </Chip>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title="Ничего не нашлось"
            body="Попробуйте выбрать другую категорию."
          />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              columnGap: "var(--grid-gap)",
              rowGap: "var(--grid-gap-row)",
            }}
          >
            {visible.map((p) => (
              <ProductCard
                key={p.id}
                title={p.title}
                price={p.price}
                was={p.was}
                tag={p.tag}
                tagTone={p.tagTone}
                soldOut={p.soldOut}
                favourite={favourites.has(p.id)}
                onFavourite={() => onFavourite && onFavourite(p.id)}
                onClick={() => onProductClick && onProductClick(p.id)}
                sizes={
                  p.soldOut ? null : p.lowStock ? (
                    <>
                      <Dot tone="butter" />
                      Остался последний размер
                    </>
                  ) : (
                    p.sizes
                  )
                }
              />
            ))}
          </div>
        )}
      </div>

      <TabBar items={TAB_ITEMS} value={activeTab} onChange={onTabChange} />
    </div>
  );
}
