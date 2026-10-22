import type { ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface NotFoundStateProps {
  title?: string;
  message?: string;
  actionText?: string;
  actionHref?: string;
  action?: ReactNode;
}

export function NotFoundState({
  title = 'Page not found',
  message = 'The page or resource you are looking for does not exist or has been moved.',
  actionText = 'Back to Dashboard',
  actionHref = '/dashboard',
  action,
}: NotFoundStateProps) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <HelpCircle size={24} />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-600">{message}</p>
      {action || (
        <Link to={actionHref} className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
          {actionText}
        </Link>
      )}
    </div>
  );
}
