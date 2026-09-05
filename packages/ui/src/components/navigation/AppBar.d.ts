/**
 * Sticky in-webview header.
 */
export interface AppBarProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Leading slot — usually nothing (Telegram draws its own BackButton). */
  left?: React.ReactNode;
  right?: React.ReactNode;
  /** Over-imagery variant: no background, no border. */
  transparent?: boolean;
  center?: boolean;
  /**
   * Что делать с тем, что не влезло в заголовок.
   * "clip" (по умолчанию) — обрезать многоточием, чтобы длинный заголовок не
   * наезжал на кнопки. "visible" — не резать: нужно, когда из заголовка
   * намеренно что-то торчит наружу.
   */
  titleOverflow?: "clip" | "visible";
  style?: React.CSSProperties;
}
export function AppBar(props: AppBarProps): JSX.Element;
