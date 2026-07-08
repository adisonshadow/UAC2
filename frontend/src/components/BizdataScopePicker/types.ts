export interface BizdataScopeOption {
  code: string;
  name: string;
  children?: BizdataScopeOption[];
}

export interface BizdataScopePickerModalProps {
  open: boolean;
  title?: string;
  value?: string[];
  maxSelection?: number;
  onOk: (codes: string[]) => void;
  onCancel: () => void;
}
