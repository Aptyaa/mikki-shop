/** Product image, or a cream placeholder tile when no photo exists yet. */
export interface PhotoSlotProps {
  src?: string;
  alt?: string;
  /** CSS aspect-ratio, e.g. "1 / 1" for grid tiles, "4 / 5" for hero. */
  ratio?: string;
  radius?: string;
  /** Placeholder caption. */
  label?: string;
  style?: React.CSSProperties;
}
export function PhotoSlot(props: PhotoSlotProps): JSX.Element;
