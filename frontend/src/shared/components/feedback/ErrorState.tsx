import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/shared/components/common/Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  action?: ReactNode;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An error occurred while loading data. Please try again.',
  onRetry,
  action,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle size={24} />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-600">{message}</p>
      {onRetry && (
        <Button className="mt-4" onClick={onRetry}>
          Try Again
        </Button>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
