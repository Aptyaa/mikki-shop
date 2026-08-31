/** Mascot-led empty state. */
export interface EmptyStateProps {
  title: React.ReactNode;
  body?: React.ReactNode;
  /** A single Button. */
  action?: React.ReactNode;
  tone?: "cream" | "butter" | "forest" | "berry";
  compact?: boolean;
  style?: React.CSSProperties;
}
export function EmptyState(props: EmptyStateProps): JSX.Element;
