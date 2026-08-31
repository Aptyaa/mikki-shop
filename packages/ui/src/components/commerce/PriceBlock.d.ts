/** Formatted RUB price. Discounted prices use --text-price-sale. */
export interface PriceBlockProps {
  price: number;
  /** Original price — renders struck through and recolours the current price. */
  was?: number;
  size?: "sm" | "md" | "lg";
  align?: "left" | "right";
  /** Put the old price on its own line under the new one — for right-aligned list rows. */
  stacked?: boolean;
  style?: React.CSSProperties;
}
export function PriceBlock(props: PriceBlockProps): JSX.Element;
