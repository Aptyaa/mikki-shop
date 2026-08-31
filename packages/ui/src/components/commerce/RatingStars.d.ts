/** Star rating. Uses the ★ glyph — the one place a unicode character stands in for an icon. */
export interface RatingStarsProps {
  value?: number;
  /** Review count, shown in brackets. */
  count?: number;
  size?: number;
  showValue?: boolean;
  style?: React.CSSProperties;
}
export function RatingStars(props: RatingStarsProps): JSX.Element;
