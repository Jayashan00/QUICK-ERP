import { AlertCircle } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { formatUserFriendlyValidationError } from '@/shared/validation/formatError';

interface FormSubmitErrorProps {
  message?: string | null;
  className?: string;
}

export function FormSubmitError({ message, className }: FormSubmitErrorProps) {
  if (!message) return null;

  const friendlyMessage = formatUserFriendlyValidationError(message);

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 shadow-sm dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300",
        className,
      )}
      role="alert"
    >
      <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
      <div className="flex-1 space-y-0.5 leading-relaxed">
        <span className="font-semibold block text-red-800 dark:text-red-200">Please review the following issue:</span>
        <span>{friendlyMessage}</span>
      </div>
    </div>
  );
}
