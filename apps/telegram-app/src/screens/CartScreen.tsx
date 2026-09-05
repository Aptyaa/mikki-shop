import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Band,
  Button,
  CartLine,
  Divider,
  EmptyState,
  Notice,
  PriceBlock,
  Skeleton,
} from "@mikki-shop/ui";
import { fetchCartPreview } from "../api/catalog";
import { AppTabs } from "../components/AppTabs";
import { ScreenBar } from "../components/ScreenBar";
import { cartKey, toCartInput, useCart } from "../lib/cart";
import { plural } from "../lib/plural";
import { goBack, navigate } from "../lib/route";

const goods = (count: number) => `${count} ${plural(count, "товар", "товара", "товаров")}`;

/** Подпись под названием: «Размер S · Сливочный». */
function variantOf(size: string, color?: string): string {
  return color ? `Размер ${size} · ${color}` : `Размер ${size}`;
}

function SkeletonLines() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
      {[0, 1].map((index) => (
        <div key={index} style={{ display: "flex", gap: "var(--sp-4)" }}>
          <Skeleton width={76} height={76} radius="var(--r-image)" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
            <Skeleton height={15} width="80%" />
            <Skeleton height={13} width="45%" />
            <Skeleton height={30} width="100%" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Корзина. Позиции живут в браузере, названия, цены и наличие считает бэкенд. */
export function CartScreen() {
  const cart = useCart((state) => state.items);
  const setQuantity = useCart((state) => state.setQuantity);
  const remove = useCart((state) => state.remove);
  const dropMissing = useCart((state) => state.dropMissing);
  const clampToStock = useCart((state) => state.clampToStock);
  const clear = useCart((state) => state.clear);

  // Что именно подрезали. Хранится на экране, а не выводится из ответа: после
  // подрезки бэкенд отвечает уже без нехватки, и объяснение исчезло бы раньше,
  // чем покупатель успел его прочитать. Ключами, а не флагом: строку могли
  // убрать или заменить, и предупреждение о ней не должно висеть вечно.
  const [adjustedKeys, setAdjustedKeys] = useState<readonly string[]>([]);

  const preview = useQuery({
    // Ключ по составу корзины: поменяли количество — пересчёт уходит сам.
    queryKey: ["cart", "preview", cart],
    queryFn: ({ signal }) => fetchCartPreview(toCartInput(cart), signal),
    // Корзина меняется чаще каталога: минута свежести из общих настроек
    // показывала бы здесь вчерашний итог.
    staleTime: 0,
    // Ключ запроса — состав корзины, то есть каждое нажатие на «+» меняет его.
    // Без этого список и «Итого» на время запроса подменялись бы скелетом.
    placeholderData: keepPreviousData,
  });

  const data = preview.data;

  // Товар мог уехать из каталога, пока корзина лежала в localStorage. Бэкенд
  // такие позиции называет — выкидываем, иначе они висят в корзине вечно.
  useEffect(() => {
    if (data?.gone.length) dropMissing(data.gone);
  }, [data?.gone, dropMissing]);

  // Взяли две штуки, на складе осталась одна — количество приводится к складу.
  // Строки с нулём не трогаем: их видно и убрать их должен покупатель.
  useEffect(() => {
    if (!data) return;
    const limits = Object.fromEntries(
      data.lines
        .filter((line) => line.maxQuantity > 0 && line.quantity > line.maxQuantity)
        .map((line) => [cartKey(line), line.maxQuantity]),
    );
    const keys = Object.keys(limits);
    if (keys.length === 0) return;
    clampToStock(limits);
    setAdjustedKeys((current) => [...new Set([...current, ...keys])]);
  }, [data, clampToStock]);

  const lines = data?.lines ?? [];
  const count = data?.count ?? 0;
  // Строки, которых уже нет в корзине, забирают с собой и предупреждение.
  const adjusted = adjustedKeys.some((key) => lines.some((line) => cartKey(line) === key));
  // Сервер отказывает всему заказу, если хотя бы одна строка не набирается со
  // склада. Строки с нулём подрезка не трогает — их убирает покупатель, — и
  // без этой проверки «оформить» вело бы в чекаут только за 409 и обратно.
  const blocked = lines.some((line) => line.quantity > line.maxQuantity);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh",
      maxWidth: "var(--content-max)", margin: "0 auto", background: "var(--bg-page)" }}>
      <ScreenBar
        title="Корзина"
        subtitle={data && count > 0 ? goods(count) : undefined}
        onBack={goBack}
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto",
        padding: "var(--sp-5) var(--gutter) var(--sp-6)" }}>
        {cart.length === 0 ? (
          <EmptyState
            title="В корзине пока пусто"
            body="Микки уже выбрал пару свитеров — посмотрите?"
            action={
              <Button onClick={() => navigate({ name: "catalog" }, { replace: true })}>
                В каталог
              </Button>
            }
          />
        ) : preview.isError ? (
          <Notice tone="danger" title="Корзина не пересчиталась">
            Проверьте соединение и попробуйте снова.
            <div style={{ marginTop: "var(--sp-4)" }}>
              <Button variant="outline" size="sm" onClick={() => preview.refetch()}>
                Повторить
              </Button>
            </div>
          </Notice>
        ) : preview.isPending ? (
          <SkeletonLines />
        ) : (
          <>
            {adjusted && (
              <Notice tone="warning" title="Количество уменьшено">
                На складе осталось меньше, чем было в корзине.
              </Notice>
            )}

            <div style={{ marginTop: adjusted ? "var(--sp-5)" : 0 }}>
              {lines.map((line, index) => {
                const key = cartKey(line);
                return (
                  <div key={key}>
                    <CartLine
                      title={line.title}
                      variant={variantOf(line.size, line.color)}
                      price={line.price}
                      qty={line.quantity}
                      maxQty={line.maxQuantity}
                      onQty={(value) => setQuantity(key, value)}
                      onRemove={() => remove(key)}
                    />
                    {line.maxQuantity === 0 && (
                      <p style={{ margin: "0 0 var(--sp-4)", fontSize: "var(--fs-caption)",
                        color: "var(--danger-500)" }}>
                        Этого размера сейчас нет. Уберите позицию или выберите другой размер.
                      </p>
                    )}
                    {index < lines.length - 1 && <Divider />}
                  </div>
                );
              })}
            </div>

            <Band tone="paper" style={{ marginTop: "var(--sp-7)" }}>
              <span>Итого</span>
              <PriceBlock price={data?.total ?? 0} size="lg" />
            </Band>

            {/* Оформлять нечего, если всё, что лежит, недоступно: итог нулевой,
                и заявка ушла бы пустой. */}
            <Button
              block
              disabled={(data?.total ?? 0) === 0 || blocked}
              onClick={() => navigate({ name: "checkout" })}
              style={{ marginTop: "var(--sp-5)" }}
            >
              Оформить заказ
            </Button>

            {blocked && (data?.total ?? 0) > 0 && (
              <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--fs-caption)",
                color: "var(--text-muted)", textAlign: "center" }}>
                Уберите позиции, которых нет в наличии, — иначе заказ не оформить.
              </p>
            )}

            <div style={{ marginTop: "var(--sp-5)", display: "flex", justifyContent: "center" }}>
              <Button variant="ghost" size="sm" onClick={clear}>
                Очистить корзину
              </Button>
            </div>
          </>
        )}
      </div>

      <AppTabs active="cart" />
    </div>
  );
}
