
export interface LogoProps {
  /**
   * horizontal — mark left, word right; the default for app bars.
   * vertical   — stacked, centred.
   * arc        — word bent over an arc above a disc; the shop-sign lockup.
   * perched    — mascot sitting on top of the word, paws on the letters.
   * peeking    — mascot cropped behind the word, head and paws only.
   * mark / wordmark — a single element on its own.
   * head       — только голова с шеей, без лап. Ширину задаёт `style`,
   *              высота считается сама; в отличие от `mark` не квадратная.
   */
  variant?: "horizontal" | "vertical" | "arc" | "perched" | "peeking" | "mark" | "wordmark" | "head";
  size?: "sm" | "md" | "lg" | "xl";
  /** ink on light surfaces, inverse on olive, primary for accent contexts. */
  tone?: "ink" | "inverse" | "primary";
  /** Override the wordmark text (e.g. "Mickey Shop" for the EN lockup). */
  word?: string;
  /** perched / peeking only — where the mascot sits along the wordmark.
   *  center (default), first-word (over «Микки»), word-gap (between the words),
   *  last-word (over «Шоп»), or a number in ems of the word size. */
  offset?: "center" | "first-word" | "word-gap" | "last-word" | number;
  /** Single-colour SVG trace — stamps, embroidery, favicons, watermarks. */
  mono?: boolean;
  /** Full-colour SVG instead of the raster mark. Carries a light plate, so only
   *  use it on flat light surfaces or inside a disc — never over an overlap. */
  vector?: boolean;
  style?: React.CSSProperties;
}
export function Logo(props: LogoProps): JSX.Element;
