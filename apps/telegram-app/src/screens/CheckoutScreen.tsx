import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Band,
  Button,
  Checkbox,
  Chip,
  Divider,
  EmptyState,
  Input,
  Notice,
  PriceBlock,
  RadioTile,
} from "@mikki-shop/ui";
import type { DeliveryMethod, Order } from "@mikki-shop/shared-types";
import { HttpError, createOrder, fetchCartPreview, fetchPets } from "../api/catalog";
import { ScreenBar } from "../components/ScreenBar";
import { useAuth } from "../lib/auth";
import { toCartInput, useCart } from "../lib/cart";
import { goBack, navigate } from "../lib/route";
import { inTelegram } from "../lib/telegram";

const DELIVERY: { key: DeliveryMethod; title: string; note: string }[] = [
  { key: "courier", title: "Курьер", note: "По Москве, день в день или на завтра" },
  { key: "pickup", title: "Самовывоз", note: "Заберёте сами, адрес пришлём" },
  { key: "post", title: "Почта", note: "По России, 3–7 дней" },
];

/** Кому нужен адрес. Те же правила, что на бэкенде. */
const NEEDS_ADDRESS: DeliveryMethod[] = ["courier", "post"];

/** Причина отказа от бэкенда: она приходит кодом, а не текстом. */
function reasonOf(error: unknown): string | undefined {
  if (!(error instanceof HttpError)) return undefined;
  return error.status === 409 ? "out-of-stock" : undefined;
}

/** Экран «заказ принят». Своего маршрута нет: он живёт ровно один раз. */
function Accepted({ order }: { order: Order }) {
  return (
    <EmptyState
      title={`Заказ ${order.number} принят`}
      body="Менеджер свяжется с вами по указанному телефону и подтвердит состав и доставку."
      action={
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          <Button onClick={() => navigate({ name: "orders" }, { replace: true })}>
            Мои заказы
          </Button>
          <Button variant="ghost" onClick={() => navigate({ name: "catalog" }, { replace: true })}>
            В каталог
          </Button>
        </div>
      }
    />
  );
}

/** Оформление заказа: заявка менеджеру, без онлайн-оплаты. */
export function CheckoutScreen() {
  const cart = useCart((state) => state.items);
  const clear = useCart((state) => state.clear);
  const user = useAuth((state) => state.user);
  const signedIn = useAuth((state) => state.token !== null);

  // Имя приходит из Telegram, телефона в `initData` нет — его вводят руками.
  const [name, setName] = useState(
    [user?.firstName, user?.lastName].filter(Boolean).join(" "),
  );
  const [phone, setPhone] = useState("");
  const [delivery, setDelivery] = useState<DeliveryMethod>("courier");
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");
  const [petName, setPetName] = useState("");
  const [consent, setConsent] = useState(false);
  const [placed, setPlaced] = useState<Order | null>(null);

  /**
   * Питомцы покупателя — чтобы кличку можно было выбрать, а не набирать.
   *
   * Тот же ключ, что у профиля: список один и тот же. Ошибку и загрузку экран
   * не показывает вовсе — поле остаётся обычным текстовым, каким и было.
   * Заказ не должен упираться в справочник, который к нему не обязателен.
   */
  const pets = useQuery({
    queryKey: ["pets"],
    queryFn: ({ signal }) => fetchPets(signal),
    enabled: signedIn,
  });

  const preview = useQuery({
    queryKey: ["cart", "preview", cart],
    queryFn: ({ signal }) => fetchCartPreview(toCartInput(cart), signal),
    staleTime: 0,
    enabled: cart.length > 0 && placed === null,
  });

  const submit = useMutation({
    mutationFn: () =>
      createOrder({
        customerName: name.trim(),
        phone: phone.trim(),
        delivery,
        ...(NEEDS_ADDRESS.includes(delivery) ? { address: address.trim() } : {}),
        ...(comment.trim() ? { comment: comment.trim() } : {}),
        ...(petName.trim() ? { petName: petName.trim() } : {}),
        // Согласие уходит на сервер, а не остаётся галочкой в интерфейсе: там
        // оно записывается к заказу отметкой времени (152-ФЗ).
        consent: true,
        items: toCartInput(cart),
      }),
    onSuccess: (order) => {
      // Корзина чистится только после ответа сервера: упади запрос раньше —
      // покупатель остался бы и без заказа, и без корзины.
      clear();
      setPlaced(order);
    },
  });

  const addressNeeded = NEEDS_ADDRESS.includes(delivery);
  const filled =
    name.trim().length > 0 &&
    phone.replace(/\D/g, "").length >= 10 &&
    (!addressNeeded || address.trim().length > 0);
  const petList = pets.data ?? [];
  const total = preview.data?.total ?? 0;
  // Нехватку сервер встретит отказом на весь заказ. Отправлять заявку, зная,
  // что она вернётся 409, — только гонять покупателя между экранами.
  const shortage = preview.data?.hasShortage === true;
  const canSubmit = signedIn && filled && consent && total > 0 && !shortage && !submit.isPending;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh",
      maxWidth: "var(--content-max)", margin: "0 auto", background: "var(--bg-page)" }}>
      <ScreenBar title={placed ? "Готово" : "Оформление"} onBack={goBack} />

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto",
        padding: "var(--sp-5) var(--gutter) var(--safe-scroll-bottom)" }}>
        {placed ? (
          <Accepted order={placed} />
        ) : cart.length === 0 ? (
          <EmptyState
            title="Оформлять нечего"
            body="В корзине пусто — сначала выберите товары."
            action={
              <Button onClick={() => navigate({ name: "catalog" }, { replace: true })}>
                В каталог
              </Button>
            }
          />
        ) : (
          <>
            {/* Заказ привязывается к покупателю, а «кто это» знает только
                Telegram: в браузере оформить нельзя, и об этом надо сказать
                до того, как человек заполнит всю форму. */}
            {!signedIn && (
              <Notice tone="warning" title="Заказ оформляется из Telegram">
                {inTelegram()
                  ? "Не удалось войти. Закройте приложение и откройте его снова."
                  : "Откройте магазин в Telegram — там заказ оформится в два касания."}
              </Notice>
            )}

            {reasonOf(submit.error) === "out-of-stock" ? (
              <Notice tone="danger" title="Часть товаров разобрали">
                Пока вы заполняли форму, остатки изменились.
                <div style={{ marginTop: "var(--sp-4)" }}>
                  <Button variant="outline" size="sm" onClick={() => navigate({ name: "cart" })}>
                    Вернуться в корзину
                  </Button>
                </div>
              </Notice>
            ) : submit.isError ? (
              <Notice tone="danger" title="Заказ не отправился">
                {submit.error instanceof HttpError && submit.error.status === 400
                  ? "Проверьте телефон и адрес."
                  : "Проверьте соединение и попробуйте снова."}
              </Notice>
            ) : null}

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)",
              marginTop: signedIn && !submit.isError ? 0 : "var(--sp-5)" }}>
              <div>
                <div className="ms-eyebrow" style={{ marginBottom: "var(--sp-3)" }}>как вас зовут</div>
                <Input value={name} placeholder="Имя" onChange={(event) => setName(event.target.value)} />
              </div>

              <div>
                <div className="ms-eyebrow" style={{ marginBottom: "var(--sp-3)" }}>телефон</div>
                <Input
                  value={phone}
                  type="tel"
                  placeholder="+7 900 000-00-00"
                  onChange={(event) => setPhone(event.target.value)}
                />
                <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--fs-caption)",
                  color: "var(--text-muted)" }}>
                  Менеджер позвонит, чтобы подтвердить состав и доставку.
                </p>
              </div>
            </div>

            <Divider style={{ margin: "var(--sp-7) 0" }} />

            <div className="ms-eyebrow" style={{ marginBottom: "var(--sp-3)" }}>как получить</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
              {DELIVERY.map((option) => (
                <RadioTile
                  key={option.key}
                  selected={delivery === option.key}
                  title={option.title}
                  subtitle={option.note}
                  onClick={() => setDelivery(option.key)}
                />
              ))}
            </div>

            {addressNeeded && (
              <div style={{ marginTop: "var(--sp-5)" }}>
                <div className="ms-eyebrow" style={{ marginBottom: "var(--sp-3)" }}>адрес</div>
                <Input
                  value={address}
                  placeholder="Город, улица, дом, квартира"
                  onChange={(event) => setAddress(event.target.value)}
                />
              </div>
            )}

            <Divider style={{ margin: "var(--sp-7) 0" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
              <div>
                <div className="ms-eyebrow" style={{ marginBottom: "var(--sp-3)" }}>кличка питомца</div>

                {/* Заведённые питомцы — пилюлями над полем. Повторное нажатие
                    снимает выбор: кличка необязательна, и передумать после
                    первого касания иначе было бы нечем. Поле остаётся
                    текстовым — заказать можно и на питомца без карточки. */}
                {petList.length > 0 && (
                  <div style={{ display: "flex", gap: "var(--sp-3)", overflowX: "auto",
                    margin: "0 calc(var(--gutter) * -1) var(--sp-4)",
                    padding: "0 var(--gutter)", scrollbarWidth: "none" }}>
                    {petList.map((pet) => (
                      <Chip
                        key={pet.id}
                        selected={petName.trim() === pet.name}
                        onClick={() =>
                          setPetName((current) => (current.trim() === pet.name ? "" : pet.name))
                        }
                      >
                        {pet.name}
                      </Chip>
                    ))}
                  </div>
                )}

                <Input
                  value={petName}
                  placeholder="Микки"
                  onChange={(event) => setPetName(event.target.value)}
                />
                <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--fs-caption)",
                  color: "var(--text-muted)" }}>
                  Необязательно. Поможет менеджеру подобрать размер, если он не подойдёт.
                </p>
              </div>

              <div>
                <div className="ms-eyebrow" style={{ marginBottom: "var(--sp-3)" }}>комментарий</div>
                <Input
                  value={comment}
                  placeholder="Домофон, время, пожелания"
                  onChange={(event) => setComment(event.target.value)}
                />
              </div>
            </div>

            <Band tone="paper" style={{ marginTop: "var(--sp-7)" }}>
              <span>Итого</span>
              <PriceBlock price={total} size="lg" />
            </Band>

            {/* Обработка персональных данных: имя, телефон и адрес — это ПД,
                и согласие на них обязательно (152-ФЗ). */}
            <div style={{ marginTop: "var(--sp-6)" }}>
              <Checkbox
                checked={consent}
                onChange={() => setConsent((current) => !current)}
                label="Согласен на обработку персональных данных: имени, телефона и адреса — чтобы доставить заказ"
              />
            </div>

            <Button
              block
              disabled={!canSubmit}
              loading={submit.isPending}
              onClick={() => submit.mutate()}
              style={{ marginTop: "var(--sp-5)" }}
            >
              Отправить заявку
            </Button>

            {signedIn && !consent && (
              <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--fs-caption)",
                color: "var(--text-muted)", textAlign: "center" }}>
                Без согласия на обработку данных заказ оформить нельзя.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
