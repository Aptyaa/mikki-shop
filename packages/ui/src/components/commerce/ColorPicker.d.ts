/** Colourway swatches. */
export interface ColorPickerProps {
  /** e.g. [{name:"Сливочный",hex:"#FFF6EA"}] */
  colors?: Array<{ name: string; hex: string }>;
  value?: string;
  onChange?: (name: string) => void;
  style?: React.CSSProperties;
}
export function ColorPicker(props: ColorPickerProps): JSX.Element;
