/**
 * Full-bleed strip of colour.
 */
export interface BandProps {
  tone?: "butter" | "ink" | "paper" | "tint";
  /** Break out of the parent's gutter so the strip touches both screen edges. Default true. */
  bleed?: boolean;
  /** flex justify-content; "between" is the default two-end layout. */
  align?: "between" | "center" | "flex-start";
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function Band(props: BandProps): JSX.Element;
