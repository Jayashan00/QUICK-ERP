import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/shared/utils/cn';
import { controlBase, controlError } from './controlStyles';

export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  value?: number | '';
  onChange?: (value: number | '') => void;
  error?: boolean;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput({ value, onChange, error, className, ...props }, ref) {
  return (
    <input
      type="number"
      ref={ref}
      aria-invalid={error || undefined}
      className={cn(controlBase, error && controlError, className)}
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
  );
});
