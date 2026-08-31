/** Mascot inside a soft coloured disc. */
export interface MascotBadgeProps {
  size?: "sm" | "md" | "lg" | "xl";
  tone?: "cream" | "butter" | "forest" | "berry";
  /** Double halo — use when the badge overlaps imagery. */
  ring?: boolean;
  style?: React.CSSProperties;
}
export function MascotBadge(props: MascotBadgeProps): JSX.Element;
