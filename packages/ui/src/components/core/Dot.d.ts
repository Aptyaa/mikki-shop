/** 5px marker dot for meta lines. Decorative — always paired with the text it marks. */
export interface DotProps {
  tone?: "butter" | "ink" | "muted";
  size?: number;
  style?: React.CSSProperties;
}
export function Dot(props: DotProps): JSX.Element;
