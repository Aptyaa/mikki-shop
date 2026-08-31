/**
 * Text field.
 */
export interface InputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  /** Error message — also turns the border red. */
  error?: string;
  /** Helper text under the field. */
  hint?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  disabled?: boolean;
  /** Render a textarea instead. */
  multiline?: boolean;
  rows?: number;
  style?: React.CSSProperties;
}
export function Input(props: InputProps): JSX.Element;
