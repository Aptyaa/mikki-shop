/** Descriptive product label. */
export interface TagProps {
  tone?: "new" | "sale" | "soft" | "neutral" | "outline";
  icon?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function Tag(props: TagProps): JSX.Element;
