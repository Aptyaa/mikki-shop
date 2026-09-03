/**
 * Product grid tile.
 */
export interface ProductCardProps {
  title: string;
  price: number;
  was?: number;
  image?: string;
  /** Corner label text, e.g. "−30%" or "НОВИНКА". */
  tag?: string;
  tagTone?: "new" | "sale" | "soft" | "neutral" | "outline";
  /** Строка под ценой: размеры «XS · S · M» либо заметка об остатке с `Dot`. */
  sizes?: React.ReactNode;
  favourite?: boolean;
  /** Omit to hide the favourite control entirely. */
  onFavourite?: () => void;
  onClick?: () => void;
  soldOut?: boolean;
  style?: React.CSSProperties;
}
export function ProductCard(props: ProductCardProps): JSX.Element;
