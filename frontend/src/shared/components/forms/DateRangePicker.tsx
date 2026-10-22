import { Calendar } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { controlBase, controlError } from './controlStyles';

export interface DateRangePickerProps {
  startDate?: string;
  endDate?: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  error?: boolean;
  startId?: string;
  endId?: string;
  startName?: string;
  endName?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  ariaDescribedBy?: string;
}

export function DateRangePicker({
  startDate = '',
  endDate = '',
  onStartDateChange,
  onEndDateChange,
  error,
  startId,
  endId,
  startName,
  endName,
  disabled,
  required,
  className,
  ariaDescribedBy,
}: DateRangePickerProps) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", className)}>
      <div className="relative flex items-center">
        <Calendar
          size={14}
          className="pointer-events-none absolute left-3 text-slate-500"
        />
        <input
          id={startId}
          name={startName}
          type="date"
          className={cn(controlBase, 'pl-9 text-xs', error && controlError)}
          value={startDate}
          disabled={disabled}
          required={required}
          onChange={(e) => onStartDateChange(e.target.value)}
          aria-label="Start date"
          aria-invalid={error || undefined}
          aria-describedby={ariaDescribedBy}
        />
      </div>
      <span className="text-center text-xs text-slate-500">to</span>
      <div className="relative flex items-center">
        <Calendar
          size={14}
          className="pointer-events-none absolute left-3 text-slate-500"
        />
        <input
          id={endId}
          name={endName}
          type="date"
          className={cn(controlBase, 'pl-9 text-xs', error && controlError)}
          value={endDate}
          disabled={disabled}
          required={required}
          onChange={(e) => onEndDateChange(e.target.value)}
          aria-label="End date"
          aria-invalid={error || undefined}
          aria-describedby={ariaDescribedBy}
        />
      </div>
    </div>
  );
}
