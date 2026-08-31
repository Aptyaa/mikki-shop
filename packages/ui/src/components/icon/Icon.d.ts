/** Lucide icon glyph, stroke 2 by default (1.75 for 16px UI chrome). */
export interface IconProps {
  /** Lucide icon name, kebab-case: "heart", "shopping-bag", "chevron-right". */
  name: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  style?: React.CSSProperties;
}
export function Icon(props: IconProps): JSX.Element;
