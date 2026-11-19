import { useEffect, useState } from 'react';
import { apiConfig } from '@/core/api/apiConfig';
import { APP_CONSTANTS } from '@/shared/constants/appConstants';
import type { User } from '@/core/auth/types/user';

export interface MaintenanceStatus {
  active: boolean;
  enabled: boolean;
  message: string;
  startAt?: string;
  endAt?: string;
  lastCheckedAt?: string;
}

const DEFAULT_MAINTENANCE: MaintenanceStatus = {
  active: false,
  enabled: false,
  message: 'VYRO ERP is temporarily unavailable while maintenance is being performed.',
  startAt: undefined,
  endAt: undefined,
};

let currentStatus: MaintenanceStatus = { ...DEFAULT_MAINTENANCE };
const listeners = new Set<(status: MaintenanceStatus) => void>();

function isSuperAdmin(): boolean {
  try {
    const raw = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.USER);
    if (!raw) return false;
    const user = JSON.parse(raw) as User;
    return Boolean(user.isSuperAdmin || user.roleId === 'role-super-admin');
  } catch {
    return false;
  }
}

export function getMaintenanceState(): MaintenanceStatus {
  return { ...currentStatus };
}

export function subscribeMaintenance(listener: (status: MaintenanceStatus) => void): () => void {
  listeners.add(listener);
  listener(currentStatus);
  return () => {
    listeners.delete(listener);
  };
}

export function triggerMaintenance(data: Partial<MaintenanceStatus>): void {
  const updated: MaintenanceStatus = {
    ...currentStatus,
    ...data,
    active: true,
    lastCheckedAt: new Date().toISOString(),
  };
  currentStatus = updated;
  listeners.forEach((listener) => listener(currentStatus));

  // Redirect tenant users to the maintenance page
  redirectToMaintenanceIfNeeded();
}

export function clearMaintenanceState(): void {
  currentStatus = {
    ...currentStatus,
    active: false,
    enabled: false,
    lastCheckedAt: new Date().toISOString(),
  };
  listeners.forEach((listener) => listener(currentStatus));
}

export function redirectToMaintenanceIfNeeded(): void {
  if (typeof window === 'undefined') return;
  if (isSuperAdmin()) return; // Super Admin is never blocked

  const path = window.location.pathname;
  if (path === '/maintenance' || path.startsWith('/super-admin') || path.startsWith('/login') && !currentStatus.active) {
    return;
  }

  // Preserve previous tenant path in sessionStorage so user can return after maintenance
  try {
    if (path !== '/maintenance' && path !== '/login' && path !== '/') {
      sessionStorage.setItem('vyro_return_path', `${window.location.pathname}${window.location.search}`);
    }
  } catch {
    // storage unavailable
  }

  window.location.assign('/maintenance');
}

/**
 * Polls the backend platform maintenance status endpoint.
 */
export async function checkMaintenanceStatus(): Promise<MaintenanceStatus> {
  const base = apiConfig.baseUrl.replace(/\/$/, '');
  const url = `${base}/platform/maintenance/status`;

  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    try {
      const token = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch {
      // ignore
    }

    const res = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (res.ok) {
      const data = (await res.json()) as {
        active: boolean;
        enabled: boolean;
        message: string;
        startAt?: string;
        endAt?: string;
      };

      const updated: MaintenanceStatus = {
        active: Boolean(data.active),
        enabled: Boolean(data.enabled),
        message: data.message || DEFAULT_MAINTENANCE.message,
        startAt: data.startAt || undefined,
        endAt: data.endAt || undefined,
        lastCheckedAt: new Date().toISOString(),
      };

      const changed = currentStatus.active !== updated.active || currentStatus.message !== updated.message || currentStatus.endAt !== updated.endAt;
      currentStatus = updated;
      if (changed) {
        listeners.forEach((listener) => listener(currentStatus));
        if (updated.active) {
          redirectToMaintenanceIfNeeded();
        }
      }
      return updated;
    }
  } catch (error) {
    // If network fails, do not unilaterally mark as maintenance unless already active
  }

  return currentStatus;
}

/**
 * React hook to observe platform maintenance status in components.
 */
export function useMaintenanceStatus() {
  const [status, setStatus] = useState<MaintenanceStatus>(currentStatus);

  useEffect(() => {
    return subscribeMaintenance((newStatus) => {
      setStatus({ ...newStatus });
    });
  }, []);

  return status;
}
