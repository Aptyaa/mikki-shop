/** Bottom tab bar, 3–5 items. */
export interface TabBarProps {
  items?: Array<{ key: string; label: string; icon?: React.ReactNode; badge?: number }>;
  value?: string;
  onChange?: (key: string) => void;
  /** Pad the bar so Telegram's MainButton can't cover it. Default true. */
  reserveMainButton?: boolean;
  style?: React.CSSProperties;
}
export function TabBar(props: TabBarProps): JSX.Element;
