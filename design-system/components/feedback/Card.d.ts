export interface CardProps {
  title?: string;
  eyebrow?: string;
  corner?: boolean;
  dossier?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}
