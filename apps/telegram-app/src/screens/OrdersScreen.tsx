import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  Notice,
  PriceBlock,
  Skeleton,
  Tag,
} from "@mikki-shop/ui";
import type { DeliveryMethod, Order, OrderStatus, TagTone } from "@mikki-shop/shared-types";
import { fetchOrders } from "../api/catalog";
import { ScreenBar } from "../components/ScreenBar";
import { useAuth } from "../lib/auth";
import { plural } from "../lib/plural";
import { goBack, navigate } from "../lib/route";

/** Статус словом и тоном. Оплаты нет: заказ ведёт менеджер. */
const STATUS: Record<OrderStatus, { label: string; tone: TagTone }> = {
  NEW: { label: "новый", tone: "new" },
  CONFIRMED: { label: "подтверждён", tone: "soft" },
  SHIPPED: { label: "отправлен", tone: "soft" },
  DONE: { label: "получен", tone: "neutral" },
  CANCELLED: { label: "отменён", tone: "outline" },
};

const DELIVERY: Record<DeliveryMethod, string> = {
  courier: "Курьер",
  pickup: "Самовывоз",
  post: "Почта",
};

const goods = (count: number) => `${count} ${plural(count, "товар", "товара", "товаров")}`;

/** Дата по-русски, без времени: точное время заказа покупателю ни к чему. */
function dateOf(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function OrderCard({ order }: { order: Order }) {
  const status = STATUS[order.status];
  const count = order.lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <Card tone="plain" style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between",
        gap: "var(--sp-4)" }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: "var(--fw-bold)",
          fontSize: "var(--fs-h3)", color: "var(--text-heading)" }}>
          Заказ {order.number}
        </span>
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>

      <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-muted)" }}>
        {dateOf(order.createdAt)} · {goods(count)} · {DELIVERY[order.delivery]}
      </span>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
        {order.lines.map((line) => (
          <div
            key={`${line.slug} ${line.size} ${line.color ?? ""}`}
            style={{ display: "flex", justifyContent: "space-between", gap: "var(--sp-4)",
              fontSize: "var(--fs-body-sm)", color: "var(--text-body)" }}
          >
            <span>
              {line.title} — {line.size}
              {line.color ? `, ${line.color}` : ""}
              {line.quantity > 1 ? ` × ${line.quantity}` : ""}
            </span>
            {/* Цена из заказа, а не из каталога: в каталоге она уже могла
                поменяться, а заплатят по той, что была. */}
            <PriceBlock price={line.price * line.quantity} size="sm" />
          </div>
        ))}
      </div>

      <Divider />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: "var(--fs-body-sm)", color: "var(--text-muted)" }}>Итого</span>
        <PriceBlock price={order.total} />
      </div>
    </Card>
  );
}

function SkeletonOrders() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-7)" }}>
      {[0, 1].map((index) => (
        <div key={index} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          <Skeleton height={22} width="45%" />
          <Skeleton height={13} width="70%" />
          <Skeleton height={40} width="100%" />
        </div>
      ))}
    </div>
  );
}

/** Мои заказы. Закрытый экран: без входа заказов и не бывает. */
export function OrdersScreen() {
  const signedIn = useAuth((state) => state.token !== null);

  const orders = useQuery({
    queryKey: ["orders"],
    queryFn: ({ signal }) => fetchOrders(signal),
    enabled: signedIn,
    // Статус меняет менеджер на своей стороне: кешировать его надолго значит
    // показывать «новый» у отправленного заказа.
    staleTime: 0,
  });

  const list = orders.data ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh",
      maxWidth: "var(--content-max)", margin: "0 auto", background: "var(--bg-page)" }}>
      <ScreenBar
        title="Мои заказы"
        subtitle={list.length > 0 ? `${list.length} ${plural(list.length, "заказ", "заказа", "заказов")}` : undefined}
        onBack={goBack}
        right={list.length > 0 ? <Badge count={list.length} /> : undefined}
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto",
        padding: "var(--sp-5) var(--gutter) var(--safe-scroll-bottom)" }}>
        {!signedIn ? (
          <EmptyState
            title="Заказы видны из Telegram"
            body="Откройте магазин в Telegram — там мы узнаем вас без пароля."
            action={
              <Button onClick={() => navigate({ name: "catalog" }, { replace: true })}>
                В каталог
              </Button>
            }
          />
        ) : orders.isError ? (
          <Notice tone="danger" title="Заказы не загрузились">
            Проверьте соединение и попробуйте снова.
            <div style={{ marginTop: "var(--sp-4)" }}>
              <Button variant="outline" size="sm" onClick={() => orders.refetch()}>
                Повторить
              </Button>
            </div>
          </Notice>
        ) : orders.isPending ? (
          <SkeletonOrders />
        ) : list.length === 0 ? (
          <EmptyState
            title="Заказов пока нет"
            body="Как только оформите первый, он появится здесь."
            action={
              <Button onClick={() => navigate({ name: "catalog" }, { replace: true })}>
                В каталог
              </Button>
            }
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--section-gap)" }}>
            {list.map((order) => (
              <OrderCard key={order.number} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
