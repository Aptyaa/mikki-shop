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
  style?: React.CSSProperties;
}
export function AppBar(props: AppBarProps): JSX.Element;
