import React from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Grid2x2,
  Heart,
  House,
  Info,
  MapPin,
  Minus,
  Package,
  PawPrint,
  Pencil,
  Plus,
  Ruler,
  Search,
  Share2,
  ShoppingBag,
  SlidersHorizontal,
  Star,
  Trash2,
  TriangleAlert,
  Truck,
  User,
  X,
} from "lucide-react";

// Дизайн-система пришла с UMD-обёрткой над `window.lucide`: она работала в
// standalone-превью инструмента, но в сборке приложения глобали нет — иконки
// молча рендерились пустыми.
//
// Реестр перечислен поимённо намеренно: `import { icons }` тянет весь набор
// Lucide (~800 КБ в бандл), а Mini App грузится по мобильной сети. Нужен новый
// глиф — добавьте его сюда; это и есть та самая «одна точка подмены набора».
const GLYPHS = {
  "alert-triangle": TriangleAlert,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "credit-card": CreditCard,
  "grid-2x2": Grid2x2,
  heart: Heart,
  home: House,
  info: Info,
  "map-pin": MapPin,
  minus: Minus,
  package: Package,
  "paw-print": PawPrint,
  pencil: Pencil,
  plus: Plus,
  ruler: Ruler,
  search: Search,
  "share-2": Share2,
  "shopping-bag": ShoppingBag,
  "sliders-horizontal": SlidersHorizontal,
  star: Star,
  "trash-2": Trash2,
  truck: Truck,
  user: User,
  x: X,
};

/** Lucide glyph. Имя — kebab-case: "heart", "shopping-bag", "chevron-right". */
export function Icon({ name, size = 20, strokeWidth = 2, color = "currentColor", style, ...rest }) {
  const Glyph = GLYPHS[name];
  if (!Glyph) {
    if (import.meta.env?.DEV) {
      console.warn(`Icon: глифа «${name}» нет в реестре components/icon/Icon.jsx`);
    }
    return null;
  }
  return (
    <span aria-hidden="true"
      style={{ display: "inline-flex", width: size, height: size, color, flexShrink: 0, ...style }}
      {...rest}>
      <Glyph size={size} strokeWidth={strokeWidth} absoluteStrokeWidth />
    </span>
  );
}
