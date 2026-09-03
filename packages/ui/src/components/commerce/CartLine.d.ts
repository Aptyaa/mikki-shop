/** Cart row. Price shown is unit price × qty. */
export interface CartLineProps {
  title: string;
  /** Variant summary, e.g. "Размер S · Сливочный". */
  variant?: string;
  price: number;
  image?: string;
  qty?: number;
  /** Stock cap for the stepper. 0 drops the stepper: nothing to pick. */
  maxQty?: number;
  onQty?: (value: number) => void;
  onRemove?: () => void;
  style?: React.CSSProperties;
}
export function CartLine(props: CartLineProps): JSX.Element;
