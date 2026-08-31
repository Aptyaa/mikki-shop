/** Hairline rule. */
export interface DividerProps {
  /** Indent by 16px to align with list text. */
  inset?: boolean;
  tone?: "subtle" | "strong";
  /** Centred dot ornament instead of a plain rule. */
  decorative?: boolean;
  style?: React.CSSProperties;
}
export function Divider(props: DividerProps): JSX.Element;
