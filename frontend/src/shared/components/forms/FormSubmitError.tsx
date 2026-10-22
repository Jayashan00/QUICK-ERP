import { AlertCircle } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface FormSubmitErrorProps {
  message?: string | null;
  className?: string;
}

export function FormSubmitError({ message, className }: FormSubmitErrorProps) {
  if (!message) return null;

  return (
    <div className={cn("flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700", className)} role="alert">
      <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
