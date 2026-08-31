/** Icon-only control, minimum 44px tap target. */
export interface IconButtonProps {
  variant?: "plain" | "filled" | "primary" | "sunken";
  size?: "sm" | "md" | "lg";
  /** Toggled state — renders the glyph in berry (used by favourite). */
  active?: boolean;
  /** Required accessible label. */
  label: string;
  onClick?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function IconButton(props: IconButtonProps): JSX.Element;
