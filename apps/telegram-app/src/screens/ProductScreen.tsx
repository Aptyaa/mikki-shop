import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Band,
  Button,
  ColorPicker,
  Divider,
  Dot,
  EmptyState,
  Icon,
  Notice,
  PhotoSlot,
  PriceBlock,
  ProductCard,
  RatingStars,
  SectionHeader,
  Sheet,
  SizeSelector,
  Skeleton,
  Tag,
} from "@mikki-shop/ui";
import type { CatalogSize, ProductDetail, ProductSizeRow } from "@mikki-shop/shared-types";
import { HttpError, fetchProduct, fetchProducts } from "../api/catalog";
import { ScreenBar } from "../components/ScreenBar";
import { goBack, navigate } from "../lib/route";

/** Сколько похожих товаров показывать под карточкой. */
const SIMILAR = 4;

/**
 * Ниже трёх отзывов звёзды не рисуются: одинокая пятёрка от одного покупателя
 * ничего не говорит о товаре, а место занимает как настоящий рейтинг.
 * Правило дизайн-системы (`components/RatingStars.prompt.md`).
 */
const MIN_REVIEWS = 3;

/** Строка характеристик: разделяется хайрлайном, у последней его нет. */
function Spec({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      style={{ display: "flex", gap: "var(--sp-6)", justifyContent: "space-between",
        alignItems: "baseline", padding: "var(--sp-4) 0",
        borderBottom: last ? "none" : "1px solid var(--border-subtle)" }}
    >
      <span style={{ flexShrink: 0, fontSize: "var(--fs-body-sm)", color: "var(--text-muted)" }}>
        {label}
      </span>
      <span style={{ fontSize: "var(--fs-body-sm)", color: "var(--text-body)", textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

/** Заглушка на первую загрузку: повторяет раскладку карточки, а не крутится колесом. */
function SkeletonCard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      <Skeleton style={{ width: "100%", aspectRatio: "4 / 5", height: "auto" }} radius="var(--r-image)" />
      <Skeleton height={26} width="80%" />
      <Skeleton height={20} width="40%" />
      <Skeleton height={44} width="100%" />
      <Skeleton height={64} width="100%" />
    </div>
  );
}

/** Таблица размеров. Мерки одни на магазин, но приезжают вместе с товаром. */
function SizeGuide({ rows }: { rows: ProductSizeRow[] }) {
  const measured = rows.filter((row) => row.chest ?? row.neck ?? row.back);
  if (measured.length === 0) {
    return <p>Мерки этого товара ещё не заведены. Напишите нам — подберём размер по фото.</p>;
  }

  const cell = { padding: "var(--sp-3) 0", borderBottom: "1px solid var(--border-subtle)" } as const;

  return (
    <>
      <p style={{ fontSize: "var(--fs-body-sm)", color: "var(--text-body)" }}>
        Меряйте собаку сантиметровой лентой, а не старую одежду. Если мерка попала между
        размерами — берите больший.
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-body-sm)" }}>
        <thead>
          <tr className="ms-eyebrow">
            <th style={{ ...cell, textAlign: "left" }}>размер</th>
            <th style={{ ...cell, textAlign: "right" }}>грудь</th>
            <th style={{ ...cell, textAlign: "right" }}>шея</th>
            <th style={{ ...cell, textAlign: "right" }}>спина</th>
          </tr>
        </thead>
        <tbody>
          {measured.map((row, index) => {
            const last = index === measured.length - 1;
            const style = last ? { ...cell, borderBottom: "none" } : cell;
            return (
              <tr key={row.size}>
                <th style={{ ...style, textAlign: "left", fontFamily: "var(--font-display)",
                  fontWeight: "var(--fw-bold)", color: "var(--text-heading)" }}>
                  {row.size}
                </th>
                <td style={{ ...style, textAlign: "right" }}>{row.chest ?? "—"}</td>
                <td style={{ ...style, textAlign: "right" }}>{row.neck ?? "—"}</td>
                <td style={{ ...style, textAlign: "right" }}>{row.back ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-muted)", marginTop: "var(--sp-4)" }}>
        Все мерки в сантиметрах.
      </p>
    </>
  );
}

/** Фотографии товара. Съёмки ещё не было — тогда это одна плашка `PhotoSlot`. */
function Gallery({ product }: { product: ProductDetail }) {
  const [current, setCurrent] = useState(0);
  const photos = product.photos;
  const shown = photos[current] ?? photos[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
      <div style={{ position: "relative" }}>
        <PhotoSlot
          ratio="4 / 5"
          src={shown}
          alt={product.title}
          style={product.soldOut ? { opacity: 0.55 } : undefined}
        />
        {product.soldOut && (
          <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <Tag tone="neutral">нет в наличии</Tag>
          </span>
        )}
      </div>

      {photos.length > 1 && (
        <div style={{ display: "flex", gap: "var(--sp-3)", overflowX: "auto", scrollbarWidth: "none" }}>
          {photos.map((photo, index) => (
            <button
              key={photo}
              type="button"
              aria-label={`Фото ${index + 1}`}
              aria-current={index === current}
              onClick={() => setCurrent(index)}
              style={{ flex: "0 0 20%", padding: 0, cursor: "pointer", background: "none",
                border: "1.5px solid",
                borderColor: index === current ? "var(--border-strong)" : "transparent",
                borderRadius: "var(--r-image)" }}
            >
              <PhotoSlot ratio="1 / 1" src={photo} alt="" label="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Карточка товара: отдельный экран под `#/product/<slug>`. */
export function ProductScreen({ slug }: { slug: string }) {
  // Выбор размера и расцветки живёт на экране: класть его некуда, пока нет
  // корзины. Когда она появится, отсюда уедет ровно эта пара значений.
  const [size, setSize] = useState<CatalogSize | undefined>(undefined);
  const [color, setColor] = useState<string | undefined>(undefined);
  const [guideOpen, setGuideOpen] = useState(false);

  const productQuery = useQuery({
    queryKey: ["catalog", "product", slug],
    queryFn: ({ signal }) => fetchProduct(slug, signal),
    // 404 — окончательный ответ: повторять запрос за товаром, которого нет,
    // значит трижды показать «загружаем» вместо «товара нет».
    retry: (failureCount, error) =>
      !(error instanceof HttpError && error.status === 404) && failureCount < 1,
  });

  const product = productQuery.data;
  const category = product?.category;

  // Похожие — просто самое популярное в той же категории: отдельного эндпоинта
  // это не стоит. Берём на один товар больше, чтобы после выкидывания текущего
  // осталось ровно `SIMILAR`.
  const similarQuery = useQuery({
    queryKey: ["catalog", "similar", category],
    queryFn: ({ signal }) =>
      fetchProducts({ category, sort: "pop", limit: SIMILAR + 1 }, signal),
    enabled: Boolean(category),
  });

  const similar = (similarQuery.data?.items ?? [])
    .filter((item) => item.slug !== slug)
    .slice(0, SIMILAR);

  const notFound = productQuery.error instanceof HttpError && productQuery.error.status === 404;
  const sizeRows = product?.sizeRows ?? [];
  const unavailable = sizeRows.filter((row) => !row.available).map((row) => row.size);
  // Расцветка по умолчанию — первая: свотчи без выбранного читаются как
  // «ни одного нет», хотя расцветка у товара всегда какая-то есть.
  const selectedColor = color ?? product?.colors[0]?.name;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh",
      maxWidth: "var(--content-max)", margin: "0 auto", background: "var(--bg-page)" }}>
      {/* Заголовка в шапке нет намеренно: Микки стоит по центру полосы, и
          длинное название категории («Верхняя одежда») наезжало бы на него.
          Категория читается над заголовком товара, где ей и место. */}
      <ScreenBar onBack={goBack} />

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto",
        padding: "var(--sp-5) var(--gutter) var(--safe-scroll-bottom)" }}>
        {notFound ? (
          <EmptyState
            title="Такого товара нет"
            body="Возможно, он снят с продажи или ссылка устарела."
            action={
              <Button
                variant="outline"
                // `replace`: возвращаться на «товара нет» кнопкой «назад» незачем.
                onClick={() => navigate({ name: "catalog" }, { replace: true })}
              >
                В каталог
              </Button>
            }
          />
        ) : productQuery.isError ? (
          <Notice tone="danger" title="Карточка не загрузилась">
            Проверьте соединение и попробуйте снова.
            <div style={{ marginTop: "var(--sp-4)" }}>
              <Button variant="outline" size="sm" onClick={() => productQuery.refetch()}>
                Повторить
              </Button>
            </div>
          </Notice>
        ) : !product ? (
          <SkeletonCard />
        ) : (
          <>
            <Gallery product={product} />

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)",
              marginTop: "var(--sp-6)" }}>
              {product.tag && (
                <span style={{ alignSelf: "flex-start" }}>
                  <Tag tone={product.tagTone}>{product.tag}</Tag>
                </span>
              )}
              <div className="ms-eyebrow">{product.categoryLabel}</div>
              <h1>{product.title}</h1>
              {product.rating != null && product.reviewCount >= MIN_REVIEWS && (
                <RatingStars value={product.rating} count={product.reviewCount} />
              )}
              <PriceBlock price={product.price} was={product.was} size="lg" />
              {product.stockNote && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)",
                  fontSize: "var(--fs-caption)", color: "var(--text-muted)" }}>
                  <Dot />
                  {product.stockNote}
                </span>
              )}
            </div>

            {/* Тексты про доставку — заглушка из дизайн-системы: настоящих
                условий ещё нет (см. «What is missing» в readme кита). */}
            <Band style={{ marginTop: "var(--sp-6)" }}>
              <span>Доставка по России</span>
              <span>от 3 000 ₽ бесплатно</span>
            </Band>

            {product.colors.length > 0 && (
              <div style={{ marginTop: "var(--sp-7)" }}>
                <div className="ms-eyebrow" style={{ marginBottom: "var(--sp-3)" }}>расцветка</div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-5)" }}>
                  <ColorPicker colors={product.colors} value={selectedColor} onChange={setColor} />
                  <span style={{ fontSize: "var(--fs-body-sm)", color: "var(--text-body)" }}>
                    {selectedColor}
                  </span>
                </div>
              </div>
            )}

            <div style={{ marginTop: "var(--sp-7)" }}>
              <div style={{ display: "flex", alignItems: "baseline",
                justifyContent: "space-between", gap: "var(--sp-4)", marginBottom: "var(--sp-3)" }}>
                <span className="ms-eyebrow">размер питомца</span>
                {/* Ссылка на таблицу обязательна рядом с выбором размера:
                    подбор размера — главный стопор покупки одежды для собак. */}
                <button
                  type="button"
                  onClick={() => setGuideOpen(true)}
                  style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)",
                    border: "none", background: "none", padding: 0, cursor: "pointer",
                    fontFamily: "var(--font-body)", fontWeight: "var(--fw-semibold)",
                    fontSize: "var(--fs-body-sm)", color: "var(--text-link)" }}
                >
                  <Icon name="ruler" size={16} />
                  Таблица размеров
                </button>
              </div>
              <SizeSelector
                sizes={product.sizes}
                value={size}
                unavailable={unavailable}
                onChange={(next) =>
                  setSize((current) => (current === next ? undefined : (next as CatalogSize)))
                }
              />
              {unavailable.length > 0 && (
                <p style={{ marginTop: "var(--sp-3)", marginBottom: 0,
                  fontSize: "var(--fs-caption)", color: "var(--text-muted)" }}>
                  Зачёркнутых размеров сейчас нет в наличии.
                </p>
              )}
            </div>

            {product.description && (
              <>
                <Divider decorative style={{ margin: "var(--sp-8) 0" }} />
                <p style={{ fontSize: "var(--fs-body)", lineHeight: "var(--lh-body)",
                  color: "var(--text-body)" }}>
                  {product.description}
                </p>
              </>
            )}

            {(product.composition ?? product.care) && (
              <div style={{ marginTop: "var(--sp-6)" }}>
                {product.composition && (
                  <Spec label="Состав" value={product.composition} last={!product.care} />
                )}
                {product.care && <Spec label="Уход" value={product.care} last />}
              </div>
            )}

            {similar.length > 0 && (
              <div style={{ marginTop: "var(--section-gap)" }}>
                <SectionHeader title="Похожие" subtitle={product.categoryLabel} />
                {/* Скроллер выходит за гаттер до краёв экрана — так в ките
                    устроены все горизонтальные ленты. */}
                <div style={{ display: "flex", gap: "var(--grid-gap)", overflowX: "auto",
                  scrollbarWidth: "none", margin: "0 calc(var(--gutter) * -1)",
                  padding: "0 var(--gutter)" }}>
                  {similar.map((item) => (
                    <div key={item.id} style={{ flex: "0 0 58%" }}>
                      <ProductCard
                        title={item.title}
                        price={item.price}
                        was={item.was}
                        tag={item.tag}
                        tagTone={item.tagTone}
                        soldOut={item.soldOut}
                        sizes={item.soldOut ? undefined : item.sizes.join(" · ")}
                        onClick={() => navigate({ name: "product", slug: item.slug })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Sheet open={guideOpen} title="Таблица размеров" onClose={() => setGuideOpen(false)}>
        <SizeGuide rows={sizeRows} />
      </Sheet>
    </div>
  );
}
