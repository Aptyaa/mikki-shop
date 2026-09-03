import { PrismaClient } from "@prisma/client";

// Ассортимент взят из витрины дизайн-системы (ui_kits/telegram/data.js) и
// расширен до размера, на котором фильтры и категории имеют смысл.
// Тексты — по правилам бренда: категория + кличка в кавычках-ёлочках,
// цены целыми рублями, остаток — фактом, без «успей купить».

const categories = [
  { key: "sweaters", label: "Свитеры", sortOrder: 1 },
  // Метки описывают то, что в категории реально лежит: в `outer` есть пуховик,
  // жилет и пальто, в `acc` — не только банданы, но и шарф, носки, шлейка.
  { key: "outer", label: "Верхняя одежда", sortOrder: 2 },
  { key: "rain", label: "Дождевики", sortOrder: 3 },
  { key: "acc", label: "Аксессуары", sortOrder: 4 },
];

/**
 * Мерки размерной сетки, одни на весь магазин: размеры шьются по одним лекалам,
 * и держать таблицу отдельно у каждого товара значило бы копировать её 28 раз.
 * Диапазоны строками — в таблице размеров это диапазон, считать по нему нечего.
 */
const measurements = {
  XS: { chestCm: "28–34", neckCm: "18–22", backCm: "20–24" },
  S: { chestCm: "34–40", neckCm: "22–26", backCm: "24–28" },
  M: { chestCm: "40–46", neckCm: "26–30", backCm: "28–33" },
  L: { chestCm: "46–54", neckCm: "30–34", backCm: "33–38" },
  XL: { chestCm: "54–62", neckCm: "34–39", backCm: "38–44" },
};

/** Остаток по умолчанию: столько штук каждого размера, если товар не оговорён отдельно. */
const DEFAULT_STOCK = 6;

/** Цвета тканей, а не интерфейса: токены дизайн-системы их не описывают. */
const palette = {
  Сливочный: "#FBF3E4",
  Овсяный: "#E7D9BE",
  Молочный: "#F6F1E7",
  Карамель: "#C98B4B",
  Горчичный: "#D8A32E",
  Кирпичный: "#B0563A",
  Хвойный: "#3F5A49",
  Джинсовый: "#4C5E7C",
  Графит: "#3B3A36",
  Ягодный: "#8E3B52",
};

/** Состав и уход общие для категории; товар может их переопределить. */
const byCategory = {
  sweaters: {
    composition: "меринос 70%, акрил 30%",
    care: "Стирка при 30°, сушить разложив на плоскости.",
  },
  outer: {
    composition: "нейлон 100%, подкладка — флис",
    care: "Стирка при 30° без отжима, не гладить.",
  },
  rain: {
    composition: "полиэстер с водоотталкивающей пропиткой",
    care: "Протирать влажной тканью, в машине не стирать.",
  },
  acc: {
    composition: "хлопок 100%",
    care: "Стирка при 40°, гладить с изнанки.",
  },
};

const products = [
  {
    slug: "sviter-saharok", category: "sweaters", title: "Вязаный свитер «Сахарок»",
    price: 1490, wasPrice: 2190, tag: "−30%", tagTone: "sale",
    sizes: ["XS", "S", "M"], stockNote: "Остался последний размер S", popularity: 96,
    description: "Плотная вязка в две нити, ворот не давит на шею. Не колется и не тянет подмышками — проверено на Микки.",
    colors: ["Сливочный", "Карамель"], rating: 4.8, reviewCount: 126,
    stock: { XS: 0, S: 1, M: 0 },
  },
  {
    slug: "dozhdevik-luzha", category: "rain", title: "Дождевик «Лужа» с капюшоном",
    price: 2390, tag: "новинка", tagTone: "new", sizes: ["S", "M", "L"], popularity: 88,
    description: "Швы проклеены, капюшон снимается на кнопках. Прогулка в дождь заканчивается сухой собакой.",
    colors: ["Горчичный", "Хвойный", "Джинсовый"], rating: 4.6, reviewCount: 34,
  },
  {
    slug: "bandana-kletka", category: "acc", title: "Бандана «Клетка»",
    price: 590, sizes: ["S", "M"], popularity: 64,
    description: "Хлопок средней плотности, завязывается узлом и не сползает.",
    colors: ["Кирпичный", "Хвойный"], rating: 4.4, reviewCount: 51,
  },
  {
    slug: "puhovik-zimnik", category: "outer", title: "Пуховик «Зимник» на молнии",
    price: 3290, wasPrice: 3990, tag: "−18%", tagTone: "sale",
    sizes: ["XS", "S", "M", "L"], stockNote: "Осталось три штуки", popularity: 71,
    description: "Синтепон 200 г, молния прикрыта планкой, чтобы не цепляла шерсть. Держит до −20°.",
    colors: ["Графит", "Ягодный"], rating: 4.9, reviewCount: 88,
    stock: { XS: 0, S: 1, M: 2, L: 0 },
  },
  {
    slug: "futbolka-poloska", category: "sweaters", title: "Футболка «Полоска»",
    price: 790, sizes: ["XS", "S", "M"], popularity: 52,
    composition: "хлопок 95%, эластан 5%",
    description: "Тонкий трикотаж на тёплый день и на дом. Полоска не выцветает после стирки.",
    colors: ["Молочный", "Джинсовый"], rating: 4.3, reviewCount: 19,
  },
  {
    slug: "kombinezon-gryazeprochnyy", category: "outer", title: "Комбинезон «Грязепрочный»",
    price: 2790, tag: "хит", tagTone: "soft", sizes: ["S", "M", "L"], popularity: 99,
    description: "Закрывает лапы и живот целиком: после осенней прогулки мыть придётся комбинезон, а не собаку.",
    colors: ["Хвойный", "Графит", "Горчичный"], rating: 4.7, reviewCount: 212,
  },
  {
    slug: "sviter-ovsyanka", category: "sweaters", title: "Свитер «Овсянка» в резинку",
    price: 1690, sizes: ["M", "L"], soldOut: true, popularity: 40,
    description: "Резинка 2×2, тянется по фигуре и возвращается в форму.",
    colors: ["Овсяный"], rating: 4.5, reviewCount: 27,
  },
  {
    slug: "dozhdevik-moros", category: "rain", title: "Дождевик «Морось» без капюшона",
    price: 1590, wasPrice: 1990, tag: "−20%", tagTone: "sale",
    sizes: ["XS", "S", "M"], popularity: 77,
    description: "Лёгкий, складывается в карман. Для собак, которые не терпят капюшон.",
    colors: ["Сливочный", "Джинсовый"], rating: 4.2, reviewCount: 43,
  },
  {
    slug: "kurtka-vetroduy", category: "outer", title: "Куртка «Ветродуй» на подкладке",
    price: 2590, sizes: ["S", "M", "L", "XL"], popularity: 68,
    description: "Флисовая подкладка и затяжка по низу — ветер не задувает под живот.",
    colors: ["Джинсовый", "Кирпичный"], rating: 4.6, reviewCount: 61,
  },
  {
    slug: "bandana-goroshek", category: "acc", title: "Бандана «Горошек»",
    price: 590, sizes: ["S", "M"], popularity: 45,
    description: "Тот же крой, что у «Клетки», другой рисунок.",
    colors: ["Молочный", "Ягодный"], rating: 4.4, reviewCount: 38,
  },
  {
    slug: "sviter-kofeynyy", category: "sweaters", title: "Свитер «Кофейный» с косами",
    price: 1790, sizes: ["XS", "S", "M", "L"], popularity: 83,
    description: "Косы по спине, рукава короткие — не мешают шагу. Тёплый на осень без куртки.",
    colors: ["Карамель", "Овсяный"], rating: 4.7, reviewCount: 95,
  },
  {
    slug: "dozhdevik-liven", category: "rain", title: "Дождевик «Ливень» на кнопках",
    price: 1890, sizes: ["XS", "S", "M"], stockNote: "Остался последний размер M", popularity: 59,
    description: "Кнопки вместо молнии: надевается на собаку, которая не стоит на месте.",
    colors: ["Горчичный", "Графит"], rating: 4.1, reviewCount: 22,
    stock: { XS: 0, S: 0, M: 1 },
  },
  {
    slug: "sviter-molochnik", category: "sweaters", title: "Свитер «Молочник» с высоким воротом",
    price: 1890, sizes: ["S", "M", "L"], popularity: 74,
    description: "Ворот закрывает шею до подбородка и отворачивается вдвое.",
    colors: ["Молочный", "Сливочный"], rating: 4.5, reviewCount: 57,
  },
  {
    slug: "sviter-krendel", category: "sweaters", title: "Свитер «Крендель» с аранами",
    price: 1990, wasPrice: 2490, tag: "−20%", tagTone: "sale", sizes: ["XS", "S"], popularity: 61,
    description: "Араны по всей спине, поэтому свитер плотнее обычного. Для мелких пород.",
    colors: ["Овсяный", "Хвойный"], rating: 4.6, reviewCount: 40,
  },
  {
    slug: "zhilet-oreh", category: "outer", title: "Жилет «Орех» на синтепоне",
    price: 1990, sizes: ["S", "M", "L"], popularity: 66,
    description: "Без рукавов: греет спину и не ограничивает лапы. На межсезонье.",
    colors: ["Карамель", "Графит"], rating: 4.4, reviewCount: 33,
  },
  {
    slug: "kurtka-suhostoy", category: "outer", title: "Куртка «Сухостой» с капюшоном",
    price: 2890, tag: "новинка", tagTone: "new", sizes: ["XS", "S", "M"], popularity: 80,
    description: "Мембрана держит воду и пропускает пар — собака не мокнет ни снаружи, ни изнутри.",
    colors: ["Хвойный", "Джинсовый"], rating: 5, reviewCount: 2,
  },
  {
    slug: "palto-tvid", category: "outer", title: "Пальто «Твид» на подкладке",
    price: 3490, sizes: ["M", "L", "XL"], stockNote: "Осталось два размера", popularity: 47,
    composition: "шерсть 60%, полиэстер 40%, подкладка — вискоза",
    description: "Твид в ёлочку, подкладка скользит и не путает шерсть.",
    colors: ["Графит", "Овсяный"], rating: 4.8, reviewCount: 16,
    stock: { M: 4, L: 2, XL: 0 },
  },
  {
    slug: "dozhdevik-kaplya", category: "rain", title: "Дождевик «Капля» со светоотражателем",
    price: 2190, sizes: ["S", "M", "L", "XL"], popularity: 72,
    description: "Светоотражающая полоса по бокам: в ноябре собаку видно с другой стороны двора.",
    colors: ["Горчичный", "Графит"], rating: 4.7, reviewCount: 74,
  },
  {
    slug: "dozhdevik-tucha", category: "rain", title: "Дождевик «Туча» удлинённый",
    price: 2490, sizes: ["M", "L"], soldOut: true, popularity: 38,
    description: "Длиннее обычного — закрывает круп и основание хвоста.",
    colors: ["Джинсовый"], rating: 4.3, reviewCount: 11,
  },
  {
    slug: "bandana-yagoda", category: "acc", title: "Бандана «Ягода» на липучке",
    price: 690, sizes: ["S", "M"], popularity: 55,
    description: "Липучка вместо узла: снимается одним движением.",
    colors: ["Ягодный", "Молочный"], rating: 4.2, reviewCount: 29,
  },
  {
    slug: "bandana-buket", category: "acc", title: "Бандана «Букет» хлопковая",
    price: 690, wasPrice: 890, tag: "−22%", tagTone: "sale", sizes: ["XS", "S", "M"], popularity: 63,
    description: "Плотный хлопок, края обмётаны — не осыпаются после стирки.",
    colors: ["Сливочный", "Ягодный"], rating: 4.5, reviewCount: 47,
  },
  {
    slug: "sharf-baranka", category: "acc", title: "Шарф-снуд «Баранка»",
    price: 890, sizes: ["S", "M", "L"], popularity: 50,
    composition: "акрил 100%",
    description: "Кольцом, без концов: не цепляется за кусты и не развязывается.",
    colors: ["Овсяный", "Кирпичный"], rating: 4.4, reviewCount: 25,
  },
  {
    slug: "noski-lapki", category: "acc", title: "Носки «Лапки», четыре пары",
    price: 590, sizes: ["XS", "S", "M"], popularity: 69,
    composition: "хлопок 80%, эластан 20%, силиконовая подошва",
    description: "Силиконовая подошва держит на ламинате. Четыре пары в комплекте — одна теряется всегда.",
    colors: ["Молочный", "Графит"], rating: 3.9, reviewCount: 63,
  },
  {
    slug: "shleyka-romashka", category: "acc", title: "Шлейка «Ромашка» с поводком",
    price: 1290, tag: "хит", tagTone: "soft", sizes: ["S", "M", "L"], popularity: 91,
    composition: "нейлоновая лента, мягкая подкладка",
    care: "Стирка вручную при 30°, сушить в тени.",
    description: "Регулируется по груди и шее, поводок в комплекте. Не давит на горло при рывке.",
    colors: ["Ягодный", "Хвойный", "Горчичный"], rating: 4.8, reviewCount: 184,
  },
  {
    slug: "futbolka-morjak", category: "sweaters", title: "Футболка «Моряк» с воротником",
    price: 890, sizes: ["XS", "S"], popularity: 44,
    composition: "хлопок 95%, эластан 5%",
    description: "Отложной воротник и полоска. Для мелких пород до 4 кг.",
    colors: ["Молочный", "Джинсовый"], rating: 4, reviewCount: 14,
  },
  {
    slug: "tolstovka-pechenka", category: "sweaters", title: "Толстовка «Печенька» с карманом",
    price: 1590, sizes: ["S", "M", "L", "XL"], popularity: 78,
    composition: "хлопок 70%, полиэстер 30%, начёс",
    description: "Начёс изнутри, карман на спине — декоративный, класть в него ничего не нужно.",
    colors: ["Карамель", "Сливочный"], rating: 4.6, reviewCount: 102,
  },
  {
    slug: "kombinezon-snegovik", category: "outer", title: "Комбинезон «Снеговик» зимний",
    price: 3690, wasPrice: 4290, tag: "−14%", tagTone: "sale",
    sizes: ["XS", "S", "M", "L"], stockNote: "Остался последний размер L", popularity: 85,
    description: "Утеплён на 250 г, манжеты на резинке. Снег не набивается под живот.",
    colors: ["Хвойный", "Ягодный"], rating: 4.9, reviewCount: 71,
    stock: { XS: 0, S: 0, M: 0, L: 1 },
  },
  {
    slug: "kurtka-vesnyanka", category: "outer", title: "Куртка «Веснянка» на молнии",
    price: 2290, sizes: ["XS", "S", "M"], popularity: 57,
    description: "Без утеплителя, на подкладке. На апрель и на сентябрь.",
    colors: ["Горчичный", "Сливочный"], rating: 4.3, reviewCount: 36,
  },
];

const prisma = new PrismaClient();

/** Остатки по размерам: распроданный товар — нули, иначе `stock` или значение по умолчанию. */
function stockFor(product) {
  return product.sizes.map((size) => ({
    size,
    quantity: product.soldOut ? 0 : (product.stock?.[size] ?? DEFAULT_STOCK),
    ...measurements[size],
  }));
}

async function main() {
  const ids = new Map();

  for (const category of categories) {
    const row = await prisma.category.upsert({
      where: { key: category.key },
      update: { label: category.label, sortOrder: category.sortOrder },
      create: category,
    });
    ids.set(category.key, row.id);
  }

  for (const product of products) {
    const { category, sizes, stock: _stock, colors, ...rest } = product;
    const data = {
      ...rest,
      soldOut: product.soldOut ?? false,
      stockNote: product.stockNote ?? null,
      wasPrice: product.wasPrice ?? null,
      tag: product.tag ?? null,
      tagTone: product.tagTone ?? null,
      description: product.description ?? null,
      composition: product.composition ?? byCategory[category].composition,
      care: product.care ?? byCategory[category].care,
      rating: product.rating ?? null,
      reviewCount: product.reviewCount ?? 0,
      // Съёмки ещё не было: место каждой фотографии держит `PhotoSlot`.
      photos: [],
      categoryId: ids.get(category),
    };
    const row = await prisma.product.upsert({
      where: { slug: product.slug },
      update: data,
      create: data,
    });

    // Размеры и расцветки переписываются целиком, а не досеиваются: иначе
    // размер, убранный из ассортимента, остался бы в базе после повторного сида.
    await prisma.productSize.deleteMany({ where: { productId: row.id } });
    await prisma.productSize.createMany({
      data: stockFor(product).map((size) => ({ ...size, productId: row.id })),
    });

    await prisma.productColor.deleteMany({ where: { productId: row.id } });
    await prisma.productColor.createMany({
      data: colors.map((name, index) => ({
        productId: row.id,
        name,
        hex: palette[name],
        sortOrder: index,
      })),
    });
  }

  console.log(`Каталог засеян: ${categories.length} категории, ${products.length} товаров.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
