import { PrismaClient } from "@prisma/client";

// Ассортимент взят из витрины дизайн-системы (ui_kits/telegram/data.js) и
// расширен до размера, на котором фильтры и категории имеют смысл.
// Тексты — по правилам бренда: категория + кличка в кавычках-ёлочках,
// цены целыми рублями, остаток — фактом, без «успей купить».

const categories = [
  { key: "sweaters", label: "Свитеры", sortOrder: 1 },
  { key: "outer", label: "Куртки", sortOrder: 2 },
  { key: "rain", label: "Дождевики", sortOrder: 3 },
  { key: "acc", label: "Банданы", sortOrder: 4 },
];

const products = [
  {
    slug: "sviter-saharok", category: "sweaters", title: "Вязаный свитер «Сахарок»",
    price: 1490, wasPrice: 2190, tag: "−30%", tagTone: "sale",
    sizes: ["XS", "S", "M"], stockNote: "Остался последний размер S", popularity: 96,
  },
  {
    slug: "dozhdevik-luzha", category: "rain", title: "Дождевик «Лужа» с капюшоном",
    price: 2390, tag: "новинка", tagTone: "new", sizes: ["S", "M", "L"], popularity: 88,
  },
  {
    slug: "bandana-kletka", category: "acc", title: "Бандана «Клетка»",
    price: 590, sizes: ["S", "M"], popularity: 64,
  },
  {
    slug: "puhovik-zimnik", category: "outer", title: "Пуховик «Зимник» на молнии",
    price: 3290, wasPrice: 3990, tag: "−18%", tagTone: "sale",
    sizes: ["XS", "S", "M", "L"], stockNote: "Осталось три штуки", popularity: 71,
  },
  {
    slug: "futbolka-poloska", category: "sweaters", title: "Футболка «Полоска»",
    price: 790, sizes: ["XS", "S", "M"], popularity: 52,
  },
  {
    slug: "kombinezon-gryazeprochnyy", category: "outer", title: "Комбинезон «Грязепрочный»",
    price: 2790, tag: "хит", tagTone: "soft", sizes: ["S", "M", "L"], popularity: 99,
  },
  {
    slug: "sviter-ovsyanka", category: "sweaters", title: "Свитер «Овсянка» в резинку",
    price: 1690, sizes: ["M", "L"], soldOut: true, popularity: 40,
  },
  {
    slug: "dozhdevik-moros", category: "rain", title: "Дождевик «Морось» без капюшона",
    price: 1590, wasPrice: 1990, tag: "−20%", tagTone: "sale",
    sizes: ["XS", "S", "M"], popularity: 77,
  },
  {
    slug: "kurtka-vetroduy", category: "outer", title: "Куртка «Ветродуй» на подкладке",
    price: 2590, sizes: ["S", "M", "L", "XL"], popularity: 68,
  },
  {
    slug: "bandana-goroshek", category: "acc", title: "Бандана «Горошек»",
    price: 590, sizes: ["S", "M"], popularity: 45,
  },
  {
    slug: "sviter-kofeynyy", category: "sweaters", title: "Свитер «Кофейный» с косами",
    price: 1790, sizes: ["XS", "S", "M", "L"], popularity: 83,
  },
  {
    slug: "dozhdevik-liven", category: "rain", title: "Дождевик «Ливень» на кнопках",
    price: 1890, sizes: ["XS", "S", "M"], stockNote: "Остался последний размер M", popularity: 59,
  },
  {
    slug: "sviter-molochnik", category: "sweaters", title: "Свитер «Молочник» с высоким воротом",
    price: 1890, sizes: ["S", "M", "L"], popularity: 74,
  },
  {
    slug: "sviter-krendel", category: "sweaters", title: "Свитер «Крендель» с аранами",
    price: 1990, wasPrice: 2490, tag: "−20%", tagTone: "sale", sizes: ["XS", "S"], popularity: 61,
  },
  {
    slug: "zhilet-oreh", category: "outer", title: "Жилет «Орех» на синтепоне",
    price: 1990, sizes: ["S", "M", "L"], popularity: 66,
  },
  {
    slug: "kurtka-suhostoy", category: "outer", title: "Куртка «Сухостой» с капюшоном",
    price: 2890, tag: "новинка", tagTone: "new", sizes: ["XS", "S", "M"], popularity: 80,
  },
  {
    slug: "palto-tvid", category: "outer", title: "Пальто «Твид» на подкладке",
    price: 3490, sizes: ["M", "L", "XL"], stockNote: "Осталось два размера", popularity: 47,
  },
  {
    slug: "dozhdevik-kaplya", category: "rain", title: "Дождевик «Капля» со светоотражателем",
    price: 2190, sizes: ["S", "M", "L", "XL"], popularity: 72,
  },
  {
    slug: "dozhdevik-tucha", category: "rain", title: "Дождевик «Туча» удлинённый",
    price: 2490, sizes: ["M", "L"], soldOut: true, popularity: 38,
  },
  {
    slug: "bandana-yagoda", category: "acc", title: "Бандана «Ягода» на липучке",
    price: 690, sizes: ["S", "M"], popularity: 55,
  },
  {
    slug: "bandana-buket", category: "acc", title: "Бандана «Букет» хлопковая",
    price: 690, wasPrice: 890, tag: "−22%", tagTone: "sale", sizes: ["XS", "S", "M"], popularity: 63,
  },
  {
    slug: "sharf-baranka", category: "acc", title: "Шарф-снуд «Баранка»",
    price: 890, sizes: ["S", "M", "L"], popularity: 50,
  },
  {
    slug: "noski-lapki", category: "acc", title: "Носки «Лапки», четыре пары",
    price: 590, sizes: ["XS", "S", "M"], popularity: 69,
  },
  {
    slug: "shleyka-romashka", category: "acc", title: "Шлейка «Ромашка» с поводком",
    price: 1290, tag: "хит", tagTone: "soft", sizes: ["S", "M", "L"], popularity: 91,
  },
  {
    slug: "futbolka-morjak", category: "sweaters", title: "Футболка «Моряк» с воротником",
    price: 890, sizes: ["XS", "S"], popularity: 44,
  },
  {
    slug: "tolstovka-pechenka", category: "sweaters", title: "Толстовка «Печенька» с карманом",
    price: 1590, sizes: ["S", "M", "L", "XL"], popularity: 78,
  },
  {
    slug: "kombinezon-snegovik", category: "outer", title: "Комбинезон «Снеговик» зимний",
    price: 3690, wasPrice: 4290, tag: "−14%", tagTone: "sale",
    sizes: ["XS", "S", "M", "L"], stockNote: "Остался последний размер L", popularity: 85,
  },
  {
    slug: "kurtka-vesnyanka", category: "outer", title: "Куртка «Веснянка» на молнии",
    price: 2290, sizes: ["XS", "S", "M"], popularity: 57,
  },
];

const prisma = new PrismaClient();

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

  for (const { category, ...product } of products) {
    const data = {
      ...product,
      soldOut: product.soldOut ?? false,
      stockNote: product.stockNote ?? null,
      wasPrice: product.wasPrice ?? null,
      tag: product.tag ?? null,
      tagTone: product.tagTone ?? null,
      categoryId: ids.get(category),
    };
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: data,
      create: data,
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
