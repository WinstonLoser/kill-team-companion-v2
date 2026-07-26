export interface StepperProps {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  onChange?: (value: number) => void;
}
