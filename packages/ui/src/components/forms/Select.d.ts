/** Native select in field clothing. */
export interface SelectProps {
  label?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  /** Strings, or {value,label} pairs. */
  options?: Array<string | { value: string; label: string }>;
  hint?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}
export function Select(props: SelectProps): JSX.Element;
