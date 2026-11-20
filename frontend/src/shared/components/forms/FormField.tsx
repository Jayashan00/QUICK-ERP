import { useId, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { formatUserFriendlyValidationError } from '@/shared/validation/formatError';

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
  const reactId = useId();
  const effectiveId = htmlFor || `field-${reactId}`;
  const errorId = `${effectiveId}-error`;
  const hintId = `${effectiveId}-hint`;

  const friendlyError = error ? formatUserFriendlyValidationError(error, label) : undefined;

  return (
    <div
      className={cn(
        "space-y-1.5",
        friendlyError &&
          "[&_input]:border-red-500 [&_input]:focus:border-red-500 [&_input]:focus:ring-red-100 " +
          "[&_select]:border-red-500 [&_select]:focus:border-red-500 [&_select]:focus:ring-red-100 " +
          "[&_textarea]:border-red-500 [&_textarea]:focus:border-red-500 [&_textarea]:focus:ring-red-100",
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
      {friendlyError && (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          className="flex items-start gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 mt-1 animate-fadeIn"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-red-500 dark:text-red-400" aria-hidden="true" />
          <span className="leading-relaxed">{friendlyError}</span>
        </p>
      )}
      {hint && !friendlyError && <p id={hintId} className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
