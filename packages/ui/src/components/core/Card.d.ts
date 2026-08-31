
export interface CardProps {
  pad?: "none" | "sm" | "md" | "lg";
  /** plain has no fill or border — use it to group content without drawing a box. */
  tone?: "card" | "plain" | "sunken" | "tint" | "inverse";
  /** Pointer cursor + hover response (background, not lift). */
  interactive?: boolean;
  /** Opt into a shadow. Only for things that genuinely float over other content. */
  elevated?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function Card(props: CardProps): JSX.Element;
