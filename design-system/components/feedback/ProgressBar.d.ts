export interface ProgressBarProps {
  value: number;
  max?: number;
  tone?: 'accent' | 'danger' | 'success';
  label?: string;
}
