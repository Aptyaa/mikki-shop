/**
 * Mock of Telegram's native MainButton, for prototypes and screenshots.
 * Square corners and platform typography on purpose — it is not our Button.
 */
export interface MainButtonMockProps {
  text?: string;
  /** Telegram's spinner state. */
  progress?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export function MainButtonMock(props: MainButtonMockProps): JSX.Element;
