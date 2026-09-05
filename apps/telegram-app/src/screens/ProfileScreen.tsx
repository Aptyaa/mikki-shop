import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Divider,
  EmptyState,
  Icon,
  IconButton,
  Input,
  Notice,
  SectionHeader,
  Sheet,
  SizeSelector,
  Skeleton,
  Tag,
} from "@mikki-shop/ui";
import type { CatalogSize, Pet, PetDraft } from "@mikki-shop/shared-types";
import { HttpError, createPet, deletePet, fetchPets, updatePet } from "../api/catalog";
import { ScreenBar } from "../components/ScreenBar";
import { useAuth } from "../lib/auth";
import { plural } from "../lib/plural";
import { goBack, navigate } from "../lib/route";

/**
 * Размерная сетка для выбора размера питомца.
 *
 * Захардкожена, в отличие от каталога, где она приходит в `CatalogResponse`:
 * тянуть ради пяти кнопок целую страницу выдачи — дороже, чем повторить
 * справочник. Разъедется — разъедется видимо, на своём же экране размеров.
 */
const SIZES: CatalogSize[] = ["XS", "S", "M", "L", "XL"];

/** Поля формы. Мерки строками: в поле ввода живёт то, что набрали. */
interface PetForm {
  name: string;
  breed: string;
  size?: CatalogSize;
  chestCm: string;
  neckCm: string;
  backCm: string;
}

const EMPTY: PetForm = { name: "", breed: "", chestCm: "", neckCm: "", backCm: "" };

function toForm(pet: Pet): PetForm {
  return {
    name: pet.name,
    breed: pet.breed ?? "",
    ...(pet.size ? { size: pet.size } : {}),
    chestCm: pet.chestCm != null ? String(pet.chestCm) : "",
    neckCm: pet.neckCm != null ? String(pet.neckCm) : "",
    backCm: pet.backCm != null ? String(pet.backCm) : "",
  };
}

/**
 * Форма → черновик для бэкенда.
 *
 * Пустая строка выкидывается, а не едет нулём: «не мерил» и «ноль сантиметров»
 * это разные вещи. Заполненная едет **как есть**, строкой: проверяет мерки
 * сервер, он же знает границы, и дублировать это на клиенте значит завести
 * два расходящихся набора правил.
 *
 * Приводить к числу здесь нельзя было бы даже при желании: `Number("38-40")`
 * даёт `NaN`, `JSON.stringify` превращает его в `null`, а `null` сервер читает
 * как «мерку стёрли» — и вместо отказа опечатка молча затирала бы сохранённый
 * обхват.
 */
function toDraft(form: PetForm): PetDraft {
  const cm = (value: string) => {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  };

  const breed = form.breed.trim();
  const chestCm = cm(form.chestCm);
  const neckCm = cm(form.neckCm);
  const backCm = cm(form.backCm);

  return {
    name: form.name.trim(),
    ...(breed ? { breed } : {}),
    ...(form.size ? { size: form.size } : {}),
    ...(chestCm !== undefined ? { chestCm } : {}),
    ...(neckCm !== undefined ? { neckCm } : {}),
    ...(backCm !== undefined ? { backCm } : {}),
  };
}

/** Мерки одной строкой. Пусто — если не сняли ни одной. */
function measurements(pet: Pet): string | undefined {
  const parts = [
    pet.chestCm != null ? `грудь ${pet.chestCm}` : undefined,
    pet.neckCm != null ? `шея ${pet.neckCm}` : undefined,
    pet.backCm != null ? `спина ${pet.backCm}` : undefined,
  ].filter((part): part is string => part !== undefined);

  return parts.length > 0 ? `${parts.join(" · ")} см` : undefined;
}

/** Первая буква для аватара-заглушки. Пусто не бывает: подставим знак. */
function initial(first?: string, username?: string): string {
  const source = (first ?? username ?? "").trim();
  return source ? source[0]!.toUpperCase() : "?";
}

/** Имя покупателя из Telegram. Пусто — покажем то, что есть. */
function displayName(first?: string, last?: string, username?: string): string {
  const full = [first, last].filter(Boolean).join(" ").trim();
  if (full) return full;
  return username ? `@${username}` : "Покупатель";
}

function PetCard({ pet, onEdit }: { pet: Pet; onEdit: () => void }) {
  const cm = measurements(pet);

  return (
    <Card tone="plain" pad="none" style={{ display: "flex", gap: "var(--sp-5)",
      alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
        gap: "var(--sp-2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: "var(--fw-bold)",
            fontSize: "var(--fs-h3)", lineHeight: "var(--lh-h3)", color: "var(--text-heading)" }}>
            {pet.name}
          </span>
          {pet.size && <Tag tone="soft">{pet.size}</Tag>}
        </div>

        {pet.breed && (
          <span style={{ fontSize: "var(--fs-body-sm)", color: "var(--text-body)" }}>
            {pet.breed}
          </span>
        )}

        <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-muted)" }}>
          {cm ?? "Мерки не сняты"}
        </span>
      </div>

      <IconButton label={`Изменить карточку: ${pet.name}`} onClick={onEdit}>
        <Icon name="pencil" />
      </IconButton>
    </Card>
  );
}

/** Кабинет покупателя: кто вошёл, его питомцы и дорога к заказам. */
export function ProfileScreen() {
  const signedIn = useAuth((state) => state.token !== null);
  const user = useAuth((state) => state.user);

  // `null` — лист закрыт, `undefined` в `pet` — заводим нового.
  const [editing, setEditing] = useState<{ pet?: Pet } | null>(null);
  const [form, setForm] = useState<PetForm>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const queryClient = useQueryClient();

  const pets = useQuery({
    queryKey: ["pets"],
    queryFn: ({ signal }) => fetchPets(signal),
    enabled: signedIn,
  });

  const closeSheet = () => {
    setEditing(null);
    setConfirmDelete(false);
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["pets"] });

  const save = useMutation({
    mutationFn: (draft: PetDraft) =>
      editing?.pet ? updatePet(editing.pet.id, draft) : createPet(draft),
    onSuccess: async () => {
      await refresh();
      closeSheet();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePet(id),
    onSuccess: async () => {
      await refresh();
      closeSheet();
    },
  });

  const openNew = () => {
    setForm(EMPTY);
    save.reset();
    remove.reset();
    setConfirmDelete(false);
    setEditing({});
  };

  const openEdit = (pet: Pet) => {
    setForm(toForm(pet));
    save.reset();
    remove.reset();
    setConfirmDelete(false);
    setEditing({ pet });
  };

  /**
   * Правка поля.
   *
   * Заодно снимает отказ прошлой попытки: иначе «питомец с такой кличкой уже
   * есть» продолжало бы гореть красным под полем, пока владелец набирает
   * другую, свободную кличку.
   */
  const field = (key: keyof PetForm) => (event: { target: { value: string } }) => {
    if (save.isError) save.reset();
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const list = pets.data ?? [];
  const busy = save.isPending || remove.isPending;

  // Кличка занята — это про поле клички, а не про форму целиком: сервер
  // отвечает на такое отдельной причиной именно ради этого места.
  const error = save.error;
  const duplicate = error instanceof HttpError && error.reason === "duplicate-name";
  const nameError = duplicate ? (error.detail ?? "Питомец с такой кличкой уже есть") : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh",
      maxWidth: "var(--content-max)", margin: "0 auto", background: "var(--bg-page)" }}>
      <ScreenBar title="Профиль" onBack={goBack} />

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto",
        padding: "var(--sp-5) var(--gutter) var(--safe-scroll-bottom)" }}>
        {!signedIn ? (
          <EmptyState
            title="Профиль виден из Telegram"
            body="Откройте магазин в Telegram — там мы узнаем вас без пароля."
            action={
              <Button onClick={() => navigate({ name: "catalog" }, { replace: true })}>
                В каталог
              </Button>
            }
          />
        ) : (
          <>
            {/* Кто вошёл. Фото из Telegram, если оно есть: аватар покупателя —
                это его фотография, а маскот здесь только замена отсутствующей. */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-5)" }}>
              {user?.photoUrl ? (
                <img
                  src={user.photoUrl}
                  alt=""
                  width={64}
                  height={64}
                  style={{ width: 64, height: 64, borderRadius: "var(--r-disc)",
                    objectFit: "cover", flexShrink: 0 }}
                />
              ) : (
                // Не маскот: знак — это магазин, а не покупатель, и в слоте
                // аватара дизайн-система его прямо не велит показывать.
                // Буква работает тем же, чем и фотография: отличает своё от
                // чужого, — и не притворяется портретом.
                <span
                  aria-hidden="true"
                  style={{ display: "grid", placeItems: "center", width: 64, height: 64,
                    flexShrink: 0, borderRadius: "var(--r-disc)",
                    background: "var(--surface-sunken)", color: "var(--text-heading)",
                    fontFamily: "var(--font-display)", fontWeight: "var(--fw-extrabold)",
                    fontSize: "var(--fs-h1)" }}
                >
                  {initial(user?.firstName, user?.username)}
                </span>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-1)",
                minWidth: 0 }}>
                <span style={{ fontFamily: "var(--font-display)",
                  fontWeight: "var(--fw-extrabold)", fontSize: "var(--fs-h2)",
                  lineHeight: "var(--lh-h2)", letterSpacing: "var(--ls-h2)",
                  color: "var(--text-heading)" }}>
                  {displayName(user?.firstName, user?.lastName, user?.username)}
                </span>
                <span style={{ fontSize: "var(--fs-body-sm)", color: "var(--text-muted)" }}>
                  Вход через Telegram — пароль не нужен
                </span>
              </div>
            </div>

            <Divider style={{ margin: "var(--sp-7) 0" }} />

            <Card
              tone="plain"
              pad="none"
              interactive
              onClick={() => navigate({ name: "orders" })}
              style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)",
                minHeight: "var(--tap-min)" }}
            >
              <Icon name="package" />
              <span style={{ flex: 1, fontSize: "var(--fs-body)", color: "var(--text-body)" }}>
                Мои заказы
              </span>
              <Icon name="chevron-right" color="var(--text-muted)" />
            </Card>

            <section style={{ marginTop: "var(--section-gap)" }}>
              <SectionHeader
                title="Питомцы"
                subtitle={
                  list.length > 0
                    ? `${list.length} ${plural(list.length, "карточка", "карточки", "карточек")}`
                    : "Мерки, чтобы не гадать с размером"
                }
                action="добавить"
                onAction={openNew}
              />

              {pets.isError ? (
                <Notice tone="danger" title="Питомцы не загрузились">
                  Проверьте соединение и попробуйте снова.
                  <div style={{ marginTop: "var(--sp-4)" }}>
                    <Button variant="outline" size="sm" onClick={() => pets.refetch()}>
                      Повторить
                    </Button>
                  </div>
                </Notice>
              ) : pets.isPending ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
                  <Skeleton height={20} width="40%" />
                  <Skeleton height={13} width="65%" />
                </div>
              ) : list.length === 0 ? (
                <EmptyState
                  compact
                  title="Питомца ещё нет"
                  body="Заведите карточку с мерками — тогда размер не придётся вспоминать в каждом заказе."
                  action={<Button onClick={openNew}>Добавить питомца</Button>}
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {list.map((pet, index) => (
                    <div key={pet.id}>
                      {index > 0 && <Divider style={{ margin: "var(--sp-5) 0" }} />}
                      <PetCard pet={pet} onEdit={() => openEdit(pet)} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <Sheet
        open={editing !== null}
        title={editing?.pet ? "Карточка питомца" : "Новый питомец"}
        onClose={closeSheet}
        footer={
          <Button
            block
            loading={save.isPending}
            disabled={busy || form.name.trim() === ""}
            onClick={() => save.mutate(toDraft(form))}
          >
            Сохранить
          </Button>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
          <Input
            label="Кличка"
            placeholder="Микки"
            value={form.name}
            onChange={field("name")}
            error={nameError}
          />

          <Input
            label="Порода"
            placeholder="Мальтипу"
            value={form.breed}
            onChange={field("breed")}
            hint="Необязательно — это для нас, чтобы советовать фасон"
          />

          <div>
            <div className="ms-eyebrow" style={{ marginBottom: "var(--sp-3)" }}>размер</div>
            <SizeSelector
              sizes={SIZES}
              value={form.size}
              onChange={(next) =>
                setForm((current) => ({
                  ...current,
                  // Повторное нажатие снимает выбор: размер необязателен, и
                  // передумать после первого касания иначе было бы нечем.
                  size: current.size === next ? undefined : (next as CatalogSize),
                }))
              }
            />
          </div>

          <div>
            <div className="ms-eyebrow" style={{ marginBottom: "var(--sp-3)" }}>мерки, см</div>
            {/* `minmax(0, 1fr)`, а не `1fr`: колонка грида по умолчанию не
                ужимается уже своего содержимого, и три поля с внутренними
                отступами вылезали за правый край листа. */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "var(--sp-3)" }}>
              {/* `inputMode` вместо `type="number"`: числовая клавиатура нужна,
                  а стрелки и колесо мыши в поле обхвата — нет. */}
              <Input label="Грудь" placeholder="38" value={form.chestCm}
                onChange={field("chestCm")} inputMode="numeric" />
              <Input label="Шея" placeholder="24" value={form.neckCm}
                onChange={field("neckCm")} inputMode="numeric" />
              <Input label="Спина" placeholder="30" value={form.backCm}
                onChange={field("backCm")} inputMode="numeric" />
            </div>
          </div>

          {/* Отказ, который не про кличку: текст берём от сервера — он знает,
              какая именно мерка не подошла. */}
          {save.isError && !duplicate && (
            <Notice tone="danger" title="Не сохранилось">
              {save.error instanceof HttpError && save.error.detail
                ? save.error.detail
                : "Проверьте соединение и попробуйте снова."}
            </Notice>
          )}

          {remove.isError && (
            <Notice tone="danger" title="Не удалилось">
              Проверьте соединение и попробуйте снова.
            </Notice>
          )}

          {editing?.pet && (
            <>
              <Divider />
              {confirmDelete ? (
                <Notice tone="warning" title={`Удалить карточку «${editing.pet.name}»?`}>
                  Прошлые заказы это не тронет — кличка в них останется.
                  <div style={{ display: "flex", gap: "var(--sp-3)",
                    marginTop: "var(--sp-4)" }}>
                    <Button
                      variant="outline"
                      size="sm"
                      loading={remove.isPending}
                      disabled={busy}
                      onClick={() => editing.pet && remove.mutate(editing.pet.id)}
                    >
                      Удалить
                    </Button>
                    <Button variant="ghost" size="sm" disabled={busy}
                      onClick={() => setConfirmDelete(false)}>
                      Оставить
                    </Button>
                  </div>
                </Notice>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  iconLeft={<Icon name="trash-2" size={18} />}
                  onClick={() => setConfirmDelete(true)}
                >
                  Удалить питомца
                </Button>
              )}
            </>
          )}
        </div>
      </Sheet>
    </div>
  );
}
