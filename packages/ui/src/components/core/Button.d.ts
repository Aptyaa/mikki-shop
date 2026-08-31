/**
 * Pill button — the brand's only button shape.
 */
export interface ButtonProps {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "soft";
  size?: "lg" | "md" | "sm";
  /** Full-width — the default inside sheets and sticky bars. */
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  as?: "button" | "a";
  href?: string;
  onClick?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function Button(props: ButtonProps): JSX.Element;
