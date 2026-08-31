/**
 * Product as a list row — the catalogue's primary layout.
 */
export interface ProductRowProps {
  title: string;
  price: number;
  was?: number;
  image?: string;
  /** One line of specifics: "меринос · XS–M · осталось 4". */
  meta?: React.ReactNode;
  /** Prefix meta with the signal Dot — for low stock, new arrivals, discounts. */
  marked?: boolean;
  soldOut?: boolean;
  favourite?: boolean;
  /** Omit to hide the favourite control entirely. */
  onFavourite?: () => void;
  onClick?: () => void;
  /** Drop the bottom rule on the last row of a list. */
  last?: boolean;
  style?: React.CSSProperties;
}
export function ProductRow(props: ProductRowProps): JSX.Element;
