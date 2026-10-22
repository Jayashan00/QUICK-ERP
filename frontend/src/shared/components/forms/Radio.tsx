import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';
import { choiceControl } from './controlStyles';

export interface RadioOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  name: string;
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  direction?: 'horizontal' | 'vertical';
  error?: boolean;
}

export function RadioGroup({
  name,
  options,
  value,
  onChange,
  direction = 'vertical',
  id,
  disabled,
  required,
  className,
  error,
  "aria-describedby": ariaDescribedBy,
}: RadioGroupProps) {
  return (
    <div role="radiogroup" aria-invalid={error || undefined} aria-describedby={ariaDescribedBy} className={cn('flex gap-2', direction === 'horizontal' ? 'flex-row flex-wrap gap-x-4' : 'flex-col', className)}>
      {options.map((opt) => (
        <label
          key={opt.value}
          className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
        >
          <input
            id={`${id ?? name}-${opt.value}`}
            type="radio"
            className={cn(choiceControl, 'rounded-full')}
            name={name}
            value={opt.value}
            checked={value === opt.value}
            disabled={disabled || opt.disabled}
            required={required}
            aria-invalid={error || undefined}
            aria-describedby={ariaDescribedBy}
            onChange={() => onChange(opt.value)}
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}
