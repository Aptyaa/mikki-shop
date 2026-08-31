/** Numeric count bubble. Renders nothing when count is 0 and dot is false. */
export interface BadgeProps {
  count?: number;
  max?: number;
  /** Render as a 9px dot with no number. */
  dot?: boolean;
  /** Each tone is a token pair that stays readable in every palette and theme. */
  tone?: "berry" | "apricot" | "forest";
  style?: React.CSSProperties;
}
export function Badge(props: BadgeProps): JSX.Element;
