/** Horizontally-scrolling filter pill. */
export interface ChipProps {
  selected?: boolean;
  icon?: React.ReactNode;
  /** Optional result count shown at reduced opacity. */
  count?: number;
  onClick?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function Chip(props: ChipProps): JSX.Element;
