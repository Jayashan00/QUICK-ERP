import { forwardRef, type InputHTMLAttributes } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { controlBase, controlError } from './controlStyles';

export interface DatePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: boolean;
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(function DatePicker({ error, className, ...props }, ref) {
  return (
    <div className="relative flex items-center">
      <Calendar
        size={16}
        className="pointer-events-none absolute left-3 text-slate-500"
      />
      <input
        ref={ref}
        type="date"
        aria-invalid={error || undefined}
        className={cn(controlBase, 'pl-9', error && controlError, className)}
        {...props}
      />
    </div>
  );
});
