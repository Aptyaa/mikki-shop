/** Pet-apparel size picker (XS–XL, or neck/chest sizes). */
export interface SizeSelectorProps {
  sizes?: string[];
  value?: string;
  onChange?: (size: string) => void;
  /** Sizes that are out of stock — shown struck through, not hidden. */
  unavailable?: string[];
  style?: React.CSSProperties;
}
export function SizeSelector(props: SizeSelectorProps): JSX.Element;
