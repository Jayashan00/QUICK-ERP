import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: boolean;
}

export function Switch({ label, checked, onChange, disabled, id, className, error, ...props }: SwitchProps) {
  const switchId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <label
      htmlFor={switchId}
      className={cn('inline-flex select-none items-center gap-2 text-sm text-slate-700', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer', className)}
    >
      <input
        type="checkbox"
        id={switchId}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-invalid={error || undefined}
        className="peer sr-only"
        {...props}
      />
      <div className={cn('relative h-5 w-9 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2', checked ? 'bg-blue-600' : 'bg-slate-300', error && 'ring-2 ring-red-500')}>
        <div className={cn('absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </div>
      {label && <span>{label}</span>}
    </label>
  );
}
