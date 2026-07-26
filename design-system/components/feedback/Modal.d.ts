export interface ModalProps {
  open: boolean;
  title: string;
  onClose?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}
