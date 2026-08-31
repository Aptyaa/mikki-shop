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
  /** Available sizes as a short string, e.g. "XS · S · M". */
  sizes?: string;
  favourite?: boolean;
  onFavourite?: () => void;
  onClick?: () => void;
  soldOut?: boolean;
  style?: React.CSSProperties;
}
export function ProductCard(props: ProductCardProps): JSX.Element;
