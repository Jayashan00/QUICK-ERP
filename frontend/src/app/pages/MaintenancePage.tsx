import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, Mail, Phone, RefreshCw, ShieldCheck, LogOut } from 'lucide-react';
import vyroIcon from '@/assets/vyro-icon.png';
import vyroWordmark from '@/assets/vyro-wordmark.webp';
import { checkMaintenanceStatus, useMaintenanceStatus } from '@/core/maintenance/maintenanceState';
import { useAuth } from '@/core/auth/auth-context';
import { resolvePostLoginPath } from '@/core/routing';
import { Button } from '@/shared/components/common/Button';

export function MaintenancePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const maintenance = useMaintenanceStatus();
  const [checking, setChecking] = useState(false);
  const [restored, setRestored] = useState(false);
  const [isPastSchedule, setIsPastSchedule] = useState(false);

  // Poll status every 5 seconds while on this page
  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      setChecking(true);
      try {
        const result = await checkMaintenanceStatus();
        if (mounted && !result.active) {
          setRestored(true);
        }
      } finally {
        if (mounted) setChecking(false);
      }
    };

    void poll();
    const interval = setInterval(poll, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Check if current time is past the configured endAt
  useEffect(() => {
    if (maintenance.endAt) {
      const end = new Date(maintenance.endAt).getTime();
      setIsPastSchedule(Date.now() > end);
    } else {
      setIsPastSchedule(false);
    }
  }, [maintenance.endAt]);

  const handleReturn = () => {
    if (isAuthenticated && user) {
      const savedPath = sessionStorage.getItem('vyro_return_path');
      sessionStorage.removeItem('vyro_return_path');
      navigate(resolvePostLoginPath(user, savedPath || undefined), { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  };

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return null;
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    } catch {
      return isoString;
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 text-slate-100 sm:px-6 lg:px-8">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-amber-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-xl">
        {/* VYRO Logo Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex items-center gap-3">
            <img src={vyroIcon} alt="VYRO" width={48} height={48} className="size-12 shrink-0 drop-shadow" />
            <img src={vyroWordmark} alt="VYRO ERP" width={140} height={42} className="h-8 w-auto brightness-200" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
            <span className="size-2 animate-ping rounded-full bg-amber-400" />
            Platform Maintenance Window
          </span>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          {restored || !maintenance.active ? (
            /* Maintenance Finished State */
            <div className="space-y-6 text-center">
              <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                <CheckCircle2 className="size-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">System Back Online</h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  Scheduled platform maintenance has completed successfully. All ERP services and modules are now fully operational.
                </p>
              </div>

              {isAuthenticated ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/30 p-4 text-left text-sm text-emerald-200">
                  <div className="flex items-center gap-2 font-medium">
                    <ShieldCheck className="size-4 shrink-0 text-emerald-400" />
                    <span>Your session has been preserved securely.</span>
                  </div>
                  <p className="mt-1 text-xs text-emerald-300/80">
                    You can return directly to your dashboard without signing in again.
                  </p>
                </div>
              ) : null}

              <Button
                type="button"
                variant="primary"
                className="w-full h-11 text-base bg-blue-600 hover:bg-blue-500"
                onClick={handleReturn}
              >
                {isAuthenticated ? 'Return to VYRO ERP' : 'Proceed to Sign In'}
              </Button>
            </div>
          ) : (
            /* Active Maintenance State */
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
                  <AlertTriangle className="size-8" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  System Under Maintenance
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  {maintenance.message || 'VYRO ERP is temporarily unavailable while maintenance is being performed.'}
                </p>
              </div>

              {/* Maintenance Schedule Timeline */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <Clock className="size-4 text-amber-400" />
                    Maintenance Schedule
                  </span>
                  <span className="text-xs text-slate-500">Local Time</span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
                  <div>
                    <span className="text-xs text-slate-500">Scheduled Start</span>
                    <p className="font-medium text-slate-200">
                      {formatDateTime(maintenance.startAt) ?? 'Immediate'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Expected Completion</span>
                    <p className="font-medium text-slate-200">
                      {formatDateTime(maintenance.endAt) ?? 'Pending update'}
                    </p>
                  </div>
                </div>

                {/* Overrun / Extended Note */}
                {isPastSchedule && (
                  <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
                    <strong>Maintenance window extended:</strong> our engineers are finalizing system validation. Access will be restored shortly.
                  </div>
                )}
                {!maintenance.endAt && (
                  <p className="mt-2 text-xs text-slate-500">
                    Duration is estimated. We are working to restore access as swiftly as possible.
                  </p>
                )}
              </div>

              {/* Session Retention Notice */}
              <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-950/30 p-3.5 text-xs text-blue-200">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-blue-400" />
                <div>
                  <span className="font-semibold text-blue-100">Your session is safe:</span>
                  <p className="mt-0.5 text-blue-300/80">
                    Active sessions remain securely preserved in the background. You will not lose your place once maintenance concludes.
                  </p>
                </div>
              </div>

              {/* Status Polling Live Bar */}
              <div className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-950/40 px-3.5 py-2 text-xs text-slate-400">
                <span className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  Auto-checking system status every 5s
                </span>
                <button
                  type="button"
                  onClick={() => void checkMaintenanceStatus()}
                  className="flex items-center gap-1 text-slate-400 hover:text-white transition"
                  disabled={checking}
                >
                  <RefreshCw className={`size-3.5 ${checking ? 'animate-spin text-blue-400' : ''}`} />
                  {checking ? 'Checking...' : 'Check now'}
                </button>
              </div>

              {/* Support Contact Information */}
              <div className="border-t border-slate-800/80 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Need Immediate Assistance?
                </p>
                <div className="grid gap-2 sm:grid-cols-2 text-xs text-slate-300">
                  <a
                    href="mailto:support@vyro.cloud"
                    className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 transition hover:border-slate-700 hover:text-white"
                  >
                    <Mail className="size-4 text-blue-400" />
                    <span>support@vyro.cloud</span>
                  </a>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-2.5">
                    <Phone className="size-4 text-emerald-400" />
                    <span>+94 11 234 5678</span>
                  </div>
                </div>
              </div>

              {/* Sign out button option if user desires */}
              {isAuthenticated && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      navigate('/login');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition"
                  >
                    <LogOut className="size-3.5" />
                    Sign out on this device
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-slate-600">
          &copy; {new Date().getFullYear()} VYRO Technologies (Pvt) Ltd. All rights reserved.
        </p>
      </div>
    </div>
  );
}
