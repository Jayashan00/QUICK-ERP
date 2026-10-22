import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/shared/utils/cn';
import { controlBase, controlError } from './controlStyles';

export interface CurrencyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  value?: number | '';
  onChange?: (value: number | '') => void;
  currency?: string;
  error?: boolean;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(function CurrencyInput({
  value,
  onChange,
  currency = '$',
  error,
  className,
  ...props
}: CurrencyInputProps, ref) {
  return (
    <div className="relative flex items-center">
      <span className="pointer-events-none absolute left-3 text-sm font-medium text-slate-500">
        {currency}
      </span>
      <input
        type="number"
        ref={ref}
        aria-invalid={error || undefined}
        step="0.01"
        className={cn(controlBase, 'pl-8', error && controlError, className)}
        value={value === undefined ? '' : value}
        onChange={(e) => {
          const val = e.target.value;
          if (val === '') {
            onChange?.('');
            return;
          }

          const parsed = Number(val);
          onChange?.(Number.isFinite(parsed) ? parsed : '');
        }}
        {...props}
      />
    </div>
  );
});
