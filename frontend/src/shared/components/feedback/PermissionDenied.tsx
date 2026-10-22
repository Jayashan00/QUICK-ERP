import { ShieldOff } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PermissionDeniedProps {
  message?: string;
}

export function PermissionDenied({ message = 'You do not have permission to access this resource.' }: PermissionDeniedProps) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <ShieldOff size={24} />
      </div>
      <h1 className="text-xl font-semibold text-slate-900">Access Denied</h1>
      <p className="mt-1 max-w-md text-sm text-slate-600">{message}</p>
      <Link to="/dashboard" className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
        Go to Dashboard
      </Link>
    </div>
  );
}
