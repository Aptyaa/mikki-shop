/** Big single-select row for delivery, payment, size groups. */
export interface RadioTileProps {
  selected?: boolean;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-aligned value, e.g. a price or "2–3 дня". */
  meta?: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}
export function RadioTile(props: RadioTileProps): JSX.Element;
