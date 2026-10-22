import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/core/auth/auth-context';
import { clearMockSession } from '@/core/auth/mockSession';
import { mockUsers } from '@/core/auth/mocks/users';
import type { User } from '@/core/auth/types/user';
import { appToast } from '@/shared/utils/toast';
import { clearBackendSession, isBackendEnabled } from './backendSession';
import './registeredStores';
import { persistenceBridge, type PersistenceStatus } from './persistenceBridge';
import { getStateAccessor, replaceArray } from './stateRegistry';

const SHOP_PATH = /^\/shop\/([^/]+)\//;

function shopTenantFromPath(): string | null {
  if (typeof window === 'undefined') return null;
  const match = SHOP_PATH.exec(`${window.location.pathname}/`);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Keeps the user list used by owner pickers and session restore in line with the loaded tenant users. */
function syncUserDirectory(current: User) {
  const accessor = getStateAccessor('core.users');
  const loaded = accessor?.kind === 'list' ? (accessor.get() as User[]) : [];
  const scopeTenant = current.isSuperAdmin ? 'platform' : current.tenantId;
  const users = loaded.filter((user) => user && user.tenantId === scopeTenant);
  const merged = users.some((user) => user.id === current.id)
    ? users.map((user) => (user.id === current.id ? { ...user, isSuperAdmin: current.isSuperAdmin } : user))
    : [current, ...users];
  replaceArray(mockUsers, merged);
}

function forceSignOut() {
  persistenceBridge.stop();
  clearMockSession();
  clearBackendSession();
  window.location.replace('/login');
}

function FullScreenMessage({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-base font-semibold text-slate-900">{title}</p>
        {detail && <p className="mt-2 text-sm text-slate-600">{detail}</p>}
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}

function SyncIndicator() {
  const [status, setStatus] = useState<PersistenceStatus>(persistenceBridge.currentStatus);
  useEffect(() => persistenceBridge.subscribe(setStatus), []);
  if (status !== 'offline') return null;
  return (
    <div role="status" className="fixed bottom-4 left-4 z-50 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 shadow">
      Offline — changes are kept and will be saved when the server is reachable.
    </div>
  );
}

/**
 * Loads the signed-in tenant's data from the backend before the ERP renders,
 * and keeps it saved while the user works. In mock mode it renders children
 * unchanged.
 */
export function PersistenceGate({ children }: { children: ReactNode }) {
  const enabled = isBackendEnabled();
  const { user } = useAuth();
  const publicTenant = enabled && !user ? shopTenantFromPath() : null;
  const target = !enabled
    ? 'off'
    : user
      ? `user:${user.id}:${user.isSuperAdmin ? 'platform' : user.tenantId}`
      : publicTenant
        ? `shop:${publicTenant}`
        : 'none';
  const [readyFor, setReadyFor] = useState<string | null>(enabled ? null : 'off');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const hadUser = useRef(Boolean(user));
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    if (!enabled) return undefined;
    persistenceBridge.onUnauthorized(() => {
      appToast.error('Your session has expired. Sign in again.');
      forceSignOut();
    });
    persistenceBridge.onRejected((message) => appToast.error(`Not saved: ${message}`));
    return () => {
      persistenceBridge.onUnauthorized(null);
      persistenceBridge.onRejected(null);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    const currentUser = userRef.current;
    if (hadUser.current && !currentUser) {
      // Signed out: reload so no tenant data stays in memory.
      forceSignOut();
      return undefined;
    }
    hadUser.current = Boolean(currentUser);
    if (target === 'none') {
      persistenceBridge.stop();
      setReadyFor('none');
      return undefined;
    }
    let cancelled = false;
    setError(null);
    setReadyFor(null);
    const start = currentUser
      ? persistenceBridge.startTenant(currentUser.isSuperAdmin ? 'platform' : currentUser.tenantId)
      : persistenceBridge.startPublic(publicTenant ?? '');
    start
      .then(() => {
        if (cancelled) return;
        if (currentUser) syncUserDirectory(currentUser);
        setReadyFor(target);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        const status = (reason as { status?: number } | null)?.status;
        if (status === 401 && currentUser) {
          forceSignOut();
          return;
        }
        setError(reason instanceof Error && reason.message ? reason.message : 'The server could not be reached.');
      });
    return () => {
      cancelled = true;
    };
    // publicTenant is part of target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, target, attempt]);

  if (!enabled) return <>{children}</>;
  if (error) {
    return (
      <FullScreenMessage
        title="Quick ERP could not load your data"
        detail={`${error} Check that the backend server is running, then try again.`}
        action={
          <div className="flex gap-2">
            <button type="button" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={() => setAttempt((value) => value + 1)}>
              Try again
            </button>
            {user && (
              <button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={forceSignOut}>
                Sign out
              </button>
            )}
          </div>
        }
      />
    );
  }
  if (readyFor !== target) return <FullScreenMessage title="Loading Quick ERP…" detail="Fetching your company data from the server." />;
  return (
    <>
      {children}
      <SyncIndicator />
    </>
  );
}
