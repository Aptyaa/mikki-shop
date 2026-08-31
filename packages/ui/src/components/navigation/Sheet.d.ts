/** Bottom sheet. Renders null when closed. */
export interface SheetProps {
  open?: boolean;
  title?: React.ReactNode;
  onClose?: () => void;
  children?: React.ReactNode;
  /** Sticky footer, usually one block Button. */
  footer?: React.ReactNode;
  style?: React.CSSProperties;
}
export function Sheet(props: SheetProps): JSX.Element | null;
