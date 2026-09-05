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
  /**
   * Экранная клавиатура на мобильном. `inputMode="numeric"` — числовая, но без
   * стрелок и колеса мыши, которые тянет за собой `type="number"`.
   * Компонент и так прокидывает остаток пропсов на поле; здесь это записано в
   * контракт, чтобы не приходилось приводить типы на каждом вызове.
   */
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email" | "url" | "search";
  /** Render a textarea instead. */
  multiline?: boolean;
  rows?: number;
  style?: React.CSSProperties;
}
export function Input(props: InputProps): JSX.Element;
