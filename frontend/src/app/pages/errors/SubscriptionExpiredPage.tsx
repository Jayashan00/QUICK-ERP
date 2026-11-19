import { AlertCircle, LogOut, Mail } from 'lucide-react';
import { useAuth } from '@/core/auth/auth-context';

interface SubscriptionExpiredPageProps {
  reason?: 'expired' | 'suspended' | 'pending';
}

export function SubscriptionExpiredPage({ reason = 'expired' }: SubscriptionExpiredPageProps) {
  const { logout } = useAuth();

  const isExpired = reason === 'expired';
  const isPending = reason === 'pending';
  const title = isPending
    ? 'Organization Pending Activation'
    : isExpired
      ? 'Subscription Expired'
      : 'Account Suspended';
  const message = isPending
    ? 'Your Quick ERP organization account is currently pending activation. Please complete the subscription payment and await Super Admin activation before accessing ERP modules.'
    : isExpired
      ? 'Your Quick ERP subscription has expired. Please contact Quick Solutions to renew your plan.'
      : 'Your Quick ERP account has been suspended. Please contact Quick Solutions to restore access.';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </span>
        </div>

        {/* Title */}
        <h1 className="mb-3 text-center text-xl font-semibold text-slate-900">{title}</h1>

        {/* Message */}
        <p className="mb-6 text-center text-sm leading-relaxed text-slate-600">{message}</p>

        {/* Contact box */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-900">Contact Quick Solutions</p>
            <p className="text-sm text-blue-700">support@quicksolutions.lk</p>
          </div>
        </div>

        {/* Sign out */}
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
