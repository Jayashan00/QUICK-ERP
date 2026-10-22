import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

export interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
  className,
}: FormFieldProps) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined;

  return (
    <div
      className={cn(
        "space-y-1.5",
        error && "[&_input]:border-red-500 [&_input]:focus:border-red-500 [&_input]:focus:ring-red-100 [&_select]:border-red-500 [&_select]:focus:border-red-500 [&_select]:focus:ring-red-100 [&_textarea]:border-red-500 [&_textarea]:focus:border-red-500 [&_textarea]:focus:ring-red-100",
        className,
      )}
    >
      {label && htmlFor && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-1 text-red-600" aria-hidden="true">*</span>}
          {required && <span className="sr-only"> (required)</span>}
        </label>
      )}
      {label && !htmlFor ? (
        <label className="block text-sm font-medium text-slate-700">
          <span>
            {label}
            {required && <span className="ml-1 text-red-600" aria-hidden="true">*</span>}
            {required && <span className="sr-only"> (required)</span>}
          </span>
          <span className="mt-1.5 block">{children}</span>
        </label>
      ) : (
        children
      )}
      {error && <p id={errorId} className="text-xs text-red-600" role="alert">{error}</p>}
      {hint && !error && <p id={hintId} className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
