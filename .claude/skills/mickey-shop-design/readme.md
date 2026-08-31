# Микки Шоп — Design System

Design system for **Микки Шоп / Mickey Shop**, an online pet-clothing store for small dogs.
The brand's mascot is **Микки**, the owner's real Maltipoo, who appears as a 1960s-style hand-drawn cartoon.

The store ships first as a **Telegram Mini App**, with a **VK Mini App** version planned. Everything here is
mobile-first at 390pt, theme-flexible (Telegram inherits the user's theme), and free of browser-chrome assumptions.

---

## Sources given

| Source | What it was | How it was used |
|---|---|---|
| `uploads/IMG_8331.png` | Screenshot of a Pinterest board, "Дизайн веб-сайтов MikkiShop" | Palette direction (apricot / cream / forest / teal), rounded display lettering, pill buttons, card density |
| `uploads/IMG_6569.png` | Photo of Микки, the live mascot | Fur colour (cream, not white), photography direction, tone |
| `uploads/IMG_8330.jpeg` | Cropped screenshot of the existing logo — cartoon Микки in a ring reading МИККИ ШОП | Background removed programmatically → `assets/mascot-mark.png`. The on-screen mark. |
| `uploads/IMG_8333.png` | BRO DOG reference — sand yellow + turquoise on ivory | Sand-yellow + turquoise direction, explored and dropped |
| `uploads/IMG_8337.jpeg` | "Buttercup Sky" palette card — yellow + cornflower blue | Yellow + cornflower direction, explored and dropped; its white-on-blue type failed contrast |
| `uploads/pasted-*.png` | Yellow palette swatch cards + bubble-lettering shop signs | Became the **Butter** palette — the one that ships — and the wordmark brief |
| `uploads/BubblezGraffiti-*.otf` | The wordmark face, Regular + Italic | Self-hosted → `assets/fonts/`, wired as `--font-wordmark`. Cyrillic verified complete. |
| `uploads/IMG-8335.svg` | Single-colour auto-trace of the mascot | → `assets/mascot-mark-mono.svg`, reachable as `<Logo mono>`. Outline only — no fill, eyes or tongue. |

No codebase, Figma file, or slide deck was provided. There is no existing product to recreate, so the
Telegram UI kit is **new design in this system's language**, not a recreation — flagged as such below.

**Caveats on the logo:** the supplied file is a 376×442 JPEG screenshot with the ring lettering clipped at
top and bottom, and JPEG artefacts around the outlines. It is usable at small sizes only.
**A vector original (SVG/AI) is needed.** Illustrated pose variations were requested but are not included —
see "What is missing" at the end.

---

## CONTENT FUNDAMENTALS

**Language.** Russian first. Cyrillic wordmark **Микки Шоп** is primary; **Mickey Shop** is the Latin secondary
lockup for packaging and international contexts. Both are set in Baloo 2 800.

**Person.** «Мы» for the shop, «вы» (lowercase) for the customer. The dog is named, never "your pet" or
"пушистик": «проверено на Микки», not «понравится вашему любимцу».

**Register.** Plain, specific, slightly dry. Warmth comes from concrete detail, never from adjectives or
punctuation. Compare:

- ✅ «Не колется и не тянет подмышками — проверено на Микки.»
- ❌ «Ваш пушистик будет в восторге!!! 🐶💕»
- ✅ «Остался последний размер S.»
- ❌ «Успей купить! Товар заканчивается!»
- ✅ «В корзине пока пусто.»
- ❌ «Ой, кажется, корзина опустела…»

**Casing.** Sentence case everywhere. Uppercase is reserved for three things: tags (НОВИНКА, −30%),
the Telegram MainButton label (platform convention), and 11px eyebrows.

**Emoji.** Never in the interface, never in product copy. One emoji is permitted in a Telegram *bot
notification*, at most.

**Exclamation marks.** At most one per screen, and only in genuinely good news («Заказ доставлен»). Never in
product descriptions.

**Numbers and units.** `1 490 ₽` — space as thousands separator, ₽ after the number, no kopecks.
Measurements in cm with an en dash range: «28–46 см». Weight «4,2 кг» with a comma.

**Product titles.** Category + nickname in guillemets: «Вязаный свитер «Сахарок»», «Дождевик «Лужа» с
капюшоном». Two lines maximum — the grid clamps at two.

**Error and empty copy.** State the fact, then one way forward. Never apologise, never blame the user.

---

## VISUAL FOUNDATIONS

### Colour
**One hue and an ink.** The palette is **Butter**: a single yellow ramp from Cornsilk
(`#FDF8E1`) to Naples yellow (`#F9DC5C`), plus a deep olive ink (`--olive-900 #2A2510`) that does the work a
second hue would. `--butter-400` acts (buttons, the Telegram MainButton), `--butter-800` carries text and
the sale tag, olive carries headings and inverse surfaces. Pure white appears **only** on cards, so a card
lifts off the page without needing a heavy shadow.

It is calm, and it is demanding: discount, rating and warning all live in the same hue and separate only by
**value, weight and placement** — not by colour. If discount signalling ever has to get louder, the place to
spend is weight and position, or a second hue introduced deliberately — not a tint of the yellow.

Semantic colours re-use the palette: success is olive, warning is butter-700, info is ink. **Danger
(`#B8402A`) is the only foreign hue in the system** — it is the one thing that must never blend in, and it
is the only status with its own background tint. Success, warning and info share `--butter-150` and separate
by text and icon.

Every neutral is olive-shifted; there is no cold grey anywhere in this brand.

Components reference **semantic aliases only** — `--action-primary`, `--surface-card`, `--text-heading`, and
the **role aliases** `--nav-active`, `--accent-fav`, `--rating-star`, `--ornament`, `--text-price-sale`,
`--border-tint`. Role aliases name the *job*, not the colour: `--accent-fav` is butter-700, and no component
knows that. This layer is why moving the whole system onto Butter changed token values and not one `.jsx`.

### Type
Three faces, three jobs, no overlap.

**Bubblez Graffiti** (`--font-wordmark`) — the wordmark, and **only** the wordmark. Self-hosted from
`assets/fonts/`, full Cyrillic. It is an **outline** face: the letter interiors take whatever is behind
them and `color` sets the outline. That gives three hard rules — never below 20px (the outlines merge),
never over photography (the interiors fill with image), never for headings or UI.

**Baloo 2** (`--font-display`) — headings, prices, button labels. 600–800. Never body copy: at 15px its
roundness gets mushy.

**Onest** (`--font-body`) — a Cyrillic-native grotesque, neutral where Baloo is warm. 400 and 500 only.

Scale is mobile-first: display 34, h1 26, h2 21, h3 17, body 15/1.5, small 13, caption 12, micro 11.
The 11px micro size is the only place letterspacing is positive (+6%) and the only place text is uppercase.

Alternate display faces that were considered (Fredoka, Dela Gothic One, Comfortaa, Pattaya, Bricolage
Grotesque) are written up in `guidelines/type-alternates.md`.

### Direction: бумага и чернила
The system was rebuilt in Aug 2026 after the first pass read as an app template. Two things caused it: a
shadow under every card, and not enough air. The chosen direction is **printed matter** — a catalogue page,
not a card feed.

What that means concretely:
- **Products are a grid, not a list.** `ProductCard` is the default: two tiles per row at 390pt, no box around them — the photograph is the tile. `ProductRow` stays for places where the sizing line has to be read alongside the price (cart, saved items) and as the `список` layout option in the mini-app kit.
- **Colour is spent in bands, not tints.** `Band` cuts a yellow strip edge to edge. Two per screen maximum. The alternative — tinting every panel — is what made the first build look generic.
- **Nothing has a shadow unless it floats.** `--sh-card` is `none`. Sheets, popovers and controls over photography get one; a card in the page flow does not.
- **Rules, not boxes.** Lists separate by 1px hairlines. The last row drops its rule.
- **Near-square corners.** Photos 2px, cards 4px, buttons 6px, tags 0. Buttons used to be pills; a pill reads as an app, and this is meant to read as print. Round is reserved for count bubbles and the mascot's disc.
- **Signals are quiet.** A 5px `Dot` prefixes the line worth reading (low stock, new arrival) instead of a second and third coloured badge — which a one-hue palette cannot supply anyway.
- **Prices are set in the body face**, semibold, not the display face. In a printed layout a price is information in a column, not a headline.

### Backgrounds
Flat Cornsilk. **No gradients at all** — the onboarding wash was removed with the paper direction. No
photographic hero backgrounds, no repeating paw patterns, no textures, no noise. No photographic hero backgrounds, no repeating paw patterns, no textures, no noise. The storybook
feeling comes from the type and the mascot, not from decoration. A decorative `• • •` dot rule
(`<Divider decorative/>`) is the only ornament in the system.

### Cards and surfaces
White fill, `--r-card` 4px, a **1px `--border-subtle` hairline**, and **no shadow**. `Card` has a
`tone="plain"` variant with no fill or border at all — used to group content without drawing a box, which is
the most common case in this direction. `elevated` opts into `--sh-3` for things that genuinely float.
Shadows are olive-tinted (`rgba(40,32,20,…)`), never black, and never stack.

### Radii
Near-square throughout: images 2px, cards and fields 4px, buttons and chips 6px, sheets 8px on the top
corners only, **tags 0**. `--r-disc` (999px) survives for the two things that must be round — count bubbles
and the mascot's disc — plus colour swatches.

### Borders
One hairline weight (1px `--border-subtle`) for structure; 1.5px `--border-strong` for interactive outlines
(fields, size buttons, outline buttons); 2px only on the Button element itself so variants can swap border
colour without shifting layout. No coloured left-border accents anywhere.

### Elevation ladder
`--sh-1` inline chips → `--sh-2` cards → `--sh-3` hovered/lifted cards and floating icon buttons →
`--sh-4` sheets and the phone frame. `--sh-focus` is a 3px apricot glow at 32% alpha.

### Motion
Three durations: 140ms (colour, hover), 220ms (layout, toggles), 360ms (sheets). Two easings:
`--ease-out` for almost everything, and `--ease-wag` — `cubic-bezier(.34,1.46,.54,1)`, a deliberate overshoot —
for press states and switch thumbs. It is the brand's tail wag and it appears nowhere else.
`prefers-reduced-motion` collapses all three durations to 0.

### Interaction states
- **Hover** (desktop / VK web only): primary buttons darken one step (500 → 600); cards lift 2px and step to `--sh-3`; ghost buttons gain a `--apricot-50` wash. Never opacity.
- **Press:** `scale(.96)` with `--ease-wag`, plus the 700 shade on primary. No ripple.
- **Focus:** `--sh-focus`, never an outline offset.
- **Selected:** ink fill (`--surface-inverse`), not the yellow. Yellow means "you can act"; ink means "this is chosen".
- **Disabled:** `--action-disabled` pale fill with muted text. Never a 50% opacity ghost.

### Transparency and blur
Used in exactly two places: the favourite button floating over a product photo
(`rgba(255,255,255,.86)` + `blur(6px)`) and the sheet scrim (`rgba(36,26,18,.44)` + `blur(2px)`).
No frosted panels, no glassmorphism. Text is never placed on an image without an opaque chip behind it.

### Imagery
Warm, slightly overexposed daylight. Cream / oat / pale-wood backgrounds — never white seamless, never grey.
The garment is worn by a small light-coloured dog, camera at dog eye level, dog looking into the lens.
Flat-lay only for accessories. No grain, no filters, no people's faces. **No photography exists yet** —
every image position in the kit is a `PhotoSlot` placeholder, so the shoot can drop straight in.

### Layout rules
390pt design width, `--content-max` 420px, **20px gutters**, **16px column gap / 28px row gap** in grids,
**36px between sections**. The row gap is deliberately larger than the column gap: without card borders, that
difference is what makes rows read as rows. Horizontal scrollers bleed to the screen edge with a negative gutter margin and
matching padding. Minimum tap target 44px, always.

**The bottom 56px belongs to Telegram.** `--safe-scroll-bottom` = 56px + safe-area inset + 20px, and every
scroll container ends with it. No CTA, tab bar, sticky element or toast may be placed inside that strip.

---

## ICONOGRAPHY

The brand had **no icon set**. Icons are **Lucide** (CDN), stroke 2, sizes 16 / 20 / 24 — a substitution,
flagged here and in `components/icon/Icon.prompt.md`. Lucide's rounded caps and even weight sit well against
Baloo 2; the alternative (Phosphor Duotone) was rejected as too decorative next to the mascot.

- **Load it:** `<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>`, then `<Icon name="shopping-bag"/>`.
- **Pin the version** before production. Consider self-hosting an SVG sprite of the ~24 glyphs actually used (listed in `components/icon/icon.card.html`).
- **Never mix families**, never mix in emoji, never fall back to a text glyph — with two exceptions, both deliberate: `★` for rating stars, and `−`/`+` (U+2212) in the quantity stepper.
- **The mascot is not an icon.** `assets/mascot-mark.png` is a brand mark; it never appears in a row of UI glyphs.

Assets in `assets/`:
- `mascot-mark.png` — the supplied logo with its background removed, 361×442. **The on-screen mark.** Raster; needs a colour vector for print.
- `mascot-mark-mono.svg` — single-colour auto-trace of the same art: outline only, no fill, no eyes, no tongue. Correct for stamps, embroidery, favicons and watermarks; reachable as `<Logo mono>`. **Not** a replacement for the colour mark.
- `fonts/BubblezGraffiti-Regular.otf`, `fonts/BubblezGraffiti-Italic.otf` — the wordmark face, self-hosted, full Cyrillic.
- `mickey-reference-photo.png` — the owner's photo of Микки. Reference for the photography grade, not for use in UI.

---

## Index

```
styles.css                  entry point — @import list only
tokens/                     colors (= Butter), typography, spacing, radius, elevation,
                            motion, platform, theme-dark, fonts, base
guidelines/                 specimen cards (Colors, Type, Spacing, Brand) + type-alternates.md
components/                 React primitives, grouped by concern
ui_kits/telegram/           click-through Mini App recreation, 9 screens
templates/mini-app-screen/  базовый экран Mini App
assets/                     mascot-mark.png (colour raster), mascot-mark-mono.svg (vector trace),
                            fonts/BubblezGraffiti-*.otf, mickey-reference-photo.png
thumbnail.html              homepage tile
SKILL.md                    Agent Skills wrapper
```

### Components

**brand/** — `Logo`, `MascotBadge`
**icon/** — `Icon`
**core/** — `Button`, `IconButton`, `Tag`, `Badge`, `Card`, `Chip`, `Divider`, `Band`, `Dot`
**forms/** — `Input`, `Select`, `Checkbox`, `Switch`, `RadioTile`
**commerce/** — `ProductRow`, `ProductCard`, `PriceBlock`, `SizeSelector`, `ColorPicker`, `QuantityStepper`, `CartLine`, `RatingStars`, `PhotoSlot`
**navigation/** — `AppBar`, `TabBar`, `SectionHeader`, `Sheet`, `MainButtonMock`
**feedback/** — `EmptyState`, `Skeleton`, `Notice`, `PawSpinner`

Every component has a sibling `.d.ts` (props contract) and `.prompt.md` (one-line what & when, usage, variants).

#### Intentional additions
No source defined a component inventory, so this is an authored set sized to a pet-apparel storefront.
Three entries are worth calling out:
- **`PhotoSlot`** — the brand has no product photography; making every image position an explicit, swappable slot is better than hardcoding `<img>` tags that 404.
- **`MainButtonMock`** — mockups need to show Telegram's native bottom strip, which real code cannot draw. Deliberately square-cornered and platform-typed so nobody mistakes it for our `Button`.
- **`Icon`** — a thin wrapper over the substituted Lucide set, so swapping icon families later is a one-file change.
- **`PawSpinner`** — the brand asked for a paw instead of a ring spinner; making it a component keeps `Button loading` and `MainButtonMock progress` consistent instead of each rolling its own.
- **`Band`** — carries the paper direction: colour spent in wide strips instead of tinted panels.
- **`Dot`** — the quiet signal that replaces a second and third badge colour, which one hue cannot supply.
- **`ProductCard`** — the catalogue's primary layout: the photograph carries the tile, sizes ride under the price.

Deliberately **not** built: Toast (Telegram has its own `showPopup`/`showAlert`), Tooltip (no hover on mobile),
Accordion, Breadcrumb, Table, Pagination, centred Dialog (the system has bottom sheets only).

---

## Палитра: Butter, и только она

Butter лежит в `:root` (`tokens/colors.css`), её тёмная тема — в `tokens/theme-dark.css`.
Атрибута `data-palette` в системе больше нет: cream / sunny / sunbeam / meadow были инструментом выбора,
выбор сделан, файлы удалены.

Компромисс, который вы принимаете вместе с Butter: одна краска — скидка, рейтинг и предупреждение
различаются тоном, весом и местом, а не цветом. Взамен — самая спокойная из рассмотренных палитр.
Единственный чужой оттенок в системе — danger `#B8402A`; он и должен выбиваться.

**Тёмная тема — не палитра, её удалять нельзя.** Telegram Mini App наследует тему пользователя,
поэтому `[data-theme="dark"]` обязателен.

---

### Микки на жёлтой полосе — диск чернильный, не масляный
Первая версия правила гласила «на жёлтом ставьте его в диск» — и этого недостаточно. Светлый диск на жёлтой
полосе даёт **1.08:1** к полосе (как шейп он просто невидим), а шерсть на нём — **1.26:1**, то есть *хуже*,
чем 1.36:1 совсем без диска. Белую шерсть нельзя отделить светлой подложкой: шерсть и есть светлое.

Работает `--surface-inverse`: шерсть **12.42:1**, диск к полосе **9.12:1** (Butter); в Meadow — **12.40:1** и **9.61:1**.
Токен уже определён в каждой палитре, так что правило держится во всех пяти. Читается как печатный штамп —
это ровно то, чего просит направление «бумага и чернила».

На **фоне страницы** (корнсилк, а не полоса) правильный диск — светлый `--disc-butter`, его и использует
`variant="arc"`: там задача диска согреть подложку, а не спасти контраст.

### Жёлтый как action-цвет
Кнопка жёлтая (`--butter-400 #F9DC5C`), текст на ней тёмный (`--olive-900 #2A2510`, 11.25:1). Это логика
самого референса — жёлтые панели там всегда несут тёмный текст. Не ставьте белый на жёлтую кнопку: контраст
уходит ниже 2:1.

Побочный плюс: `#F9DC5C` достаточно тёмный для светлой темы и достаточно светлый для тёмной, поэтому
**заливка кнопки одна и та же в обеих темах** — меняется только текст на ней. Ни одна другая палитра
в системе так не умеет.

---

## Лоадер — лапка

`PawSpinner` — единственный индикатор загрузки в системе. Отпечаток лапы (Lucide `paw-print`), крутится
**восемью дискретными шагами**, а не плавно, поэтому читается как лапа, идущая по кругу, а не как колесо.
`Button loading` и `MainButtonMock progress` используют его автоматически; кольцевой спиннер удалён из обоих.
Для ожиданий дольше ~1,5 с — `Skeleton`, повторяющий реальную раскладку.

---

### Контраст — правило, а не проверка постфактум
Все action-заливки, плашки и ссылки прогнаны по WCAG AA во всех восьми комбинациях палитра×тема.
Три правила, которые это держат:

1. **Заливка и текст на ней должны быть парой алиасов, которые переключаются вместе.** `--surface-inverse` +
   `--text-inverse`, `--action-primary` + `--text-on-primary`, `--tag-sale-bg` + `--tag-sale-fg`. Сырое
   значение рампы рядом с семантическим алиасом ломается в тёмной теме: `--forest-800` + `--text-inverse`
   давало 1.22, потому что тёмная тема переворачивает только второе. На этом спотыкались `Chip`,
   `SizeSelector` и `Badge`.
2. **Ни один брендовый цвет здесь не держит белый текст.** Жёлтый `#F9DC5C` + белый = 1.5, апельсин
   `#ED7B2F` + белый = 2.81, бирюза `#3FAABF` + белый = 2.72. Поэтому `--text-on-primary` во всех четырёх
   палитрах тёмный. Кнопка остаётся брендовой по заливке, читаемой по тексту. Белый текст допустим только
   на `butter-800`, `olive-800` и `mist-700` — единственных достаточно тёмных заливках в системе.
3. **Единственное исключение — диск `MascotBadge`.** Роли `--disc-cream`, `--disc-butter`, `--disc-forest`,
   `--disc-berry` намеренно держат светлые значения и **не** переворачиваются в тёмной теме: у Микки белая
   шерсть, ей нужна светлая подложка независимо от темы. Единственное место в системе, где это оправдано.

Проверка прогоняется по восьми комбинациям (4 палитры × 2 темы) для восьми ролей, несущих текст:
`--nav-active`, `--tag-sale-*`, `--text-link`, `--tag-soft-*`, `--text-on-primary`, `--surface-inverse` +
`--text-inverse`, `--text-heading`. Текущий минимум по системе — **4.83**.

---

## What is missing / needs you

1. **Цветной знак в векторе.** Присланный SVG (`assets/mascot-mark-mono.svg`) — одноцветная авто-трассировка
   чёрным контуром: без заливки, без глаз, без языка. Годится для штампа, вышивки, фавикона и водяного
   знака — и подключён как `<Logo mono>` именно для этого. **На экране по-прежнему работает растр**
   `mascot-mark.png` (361×442, вырезан из JPEG). Нужен цветной SVG — с заливками и раздельными контурами.
2. **Варианты поз.** Иллюстрацию здесь не сгенерировать. Система готова: позы кладутся в `assets/`
   и подхватываются `Logo` / `MascotBadge` без переделок.
3. **Фото товаров.** Бриф на съёмку написан (`guidelines/brand-photography.html`), самих фото нет —
   каждая картинка в ките это `PhotoSlot`.
4. **Baloo 2 и Onest грузятся с Google Fonts.** Локально лежит только Bubblez Graffiti. Положить woff2
   остальных двух в `assets/fonts/` до продакшена — сейчас в CSS-замыкании один `@font-face`.
5. **Тёмные темы не проверены на устройстве** — ни одна из четырёх.
6. **Реальные тексты** про доставку, возврат и часы поддержки — в ките заглушки.
