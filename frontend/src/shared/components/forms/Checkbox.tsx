import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';
import { choiceControl } from './controlStyles';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  error?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, id, error, ...props },
  ref,
) {
  const inputId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <label
      htmlFor={inputId}
      className={cn('inline-flex cursor-pointer select-none items-center gap-2 text-sm text-slate-700 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50', className)}
    >
      <input ref={ref} type="checkbox" id={inputId} aria-invalid={error || undefined} className={choiceControl} {...props} />
      {label && <span>{label}</span>}
    </label>
  );
});
