import type { User } from '@/core/auth/types/user';
import { APP_CONSTANTS } from '@/shared/constants/appConstants';

export interface MockSession {
  userId: string;
  tenantId: string | null;
  selectedBranchId: string | null;
  expiresAt?: string;
}

type SessionLocation = 'local' | 'session';

function getStorage(location: SessionLocation): Storage {
  return location === 'local' ? localStorage : sessionStorage;
}

function parseSession(value: string | null): MockSession | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'userId' in parsed &&
      typeof parsed.userId === 'string'
    ) {
      const tenantId = 'tenantId' in parsed && typeof parsed.tenantId === 'string'
        ? parsed.tenantId
        : null;
      const selectedBranchId =
        'selectedBranchId' in parsed && typeof parsed.selectedBranchId === 'string'
          ? parsed.selectedBranchId
          : null;
      const expiresAt = 'expiresAt' in parsed && typeof parsed.expiresAt === 'string' ? parsed.expiresAt : undefined;

      return { userId: parsed.userId, tenantId, selectedBranchId, expiresAt };
    }
  } catch {
    return null;
  }

  return null;
}

export function readMockSession(): {
  session: MockSession;
  location: SessionLocation;
} | null {
  const key = APP_CONSTANTS.STORAGE_KEYS.MOCK_SESSION;
  const localSession = parseSession(localStorage.getItem(key));
  if (localSession) return { session: localSession, location: 'local' };

  const temporarySession = parseSession(sessionStorage.getItem(key));
  if (temporarySession) return { session: temporarySession, location: 'session' };

  return null;
}

export function writeMockSession(
  user: User,
  remember: boolean,
  selectedBranchId: string | null = user.isSuperAdmin ? null : user.defaultBranchId,
): void {
  const location: SessionLocation = remember ? 'local' : 'session';
  const otherLocation: SessionLocation = remember ? 'session' : 'local';
  const session: MockSession = {
    userId: user.id,
    tenantId: user.isSuperAdmin ? null : user.tenantId,
    selectedBranchId,
    expiresAt: new Date(Date.now() + (remember ? 24 : 8) * 60 * 60 * 1000).toISOString(),
  };

  getStorage(otherLocation).removeItem(APP_CONSTANTS.STORAGE_KEYS.MOCK_SESSION);
  getStorage(location).setItem(
    APP_CONSTANTS.STORAGE_KEYS.MOCK_SESSION,
    JSON.stringify(session),
  );
}

export function updateMockSessionBranch(branchId: string | null): void {
  const restored = readMockSession();
  if (!restored) return;

  getStorage(restored.location).setItem(
    APP_CONSTANTS.STORAGE_KEYS.MOCK_SESSION,
    JSON.stringify({ ...restored.session, selectedBranchId: branchId }),
  );
}

export function clearMockSession(): void {
  const keys = APP_CONSTANTS.STORAGE_KEYS;
  const legacyKeys = [keys.AUTH_TOKEN, keys.USER, keys.TENANT, keys.BRANCH];

  localStorage.removeItem(keys.MOCK_SESSION);
  sessionStorage.removeItem(keys.MOCK_SESSION);
  legacyKeys.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}
