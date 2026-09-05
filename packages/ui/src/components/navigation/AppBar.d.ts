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
   * На сколько пикселей заголовку разрешено рисовать за своими границами.
   *
   * По умолчанию 0 — заголовок обрезается многоточием по колонке, чтобы
   * длинный не наезжал на кнопки справа. Больше нуля — обрезка по колонке
   * остаётся, но то, что торчит наружу (украшение у заголовка), рисуется.
   */
  titleBleed?: number;
  style?: React.CSSProperties;
}
export function AppBar(props: AppBarProps): JSX.Element;
