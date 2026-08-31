/** Rotating paw print — the only loading indicator in this brand. */
export interface PawSpinnerProps {
  size?: number;
  color?: string;
  /** One full turn, as a CSS duration. Default "1.1s". */
  speed?: string;
  style?: React.CSSProperties;
}
export function PawSpinner(props: PawSpinnerProps): JSX.Element;
