export interface ButtonProps {
  label: string;
  tone?: 'primary' | 'secondary';
  disabled?: boolean;
}

export function Button({ label, tone = 'primary', disabled = false }: ButtonProps) {
  return <button data-tone={tone} disabled={disabled}>{label}</button>;
}
