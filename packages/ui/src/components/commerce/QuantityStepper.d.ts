/** Quantity −/+ stepper. */
export interface QuantityStepperProps {
  value?: number;
  min?: number;
  max?: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md";
  style?: React.CSSProperties;
}
export function QuantityStepper(props: QuantityStepperProps): JSX.Element;
