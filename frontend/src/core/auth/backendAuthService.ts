import {
  authenticateWithBackend,
  backendMfaEnabled,
  clearBackendSession,
  clearPendingChallenge,
  readStoredBackendUser,
  revokeBackendSession,
  verifyBackendMfa,
} from '@/core/persistence/backendSession';
import { APP_CONSTANTS } from '@/shared/constants/appConstants';
import type { AuthService } from './types/authService';

const BRANCH_KEY = APP_CONSTANTS.STORAGE_KEYS.BRANCH;

/**
 * Sign-in against the Spring Boot backend (VITE_USE_MOCKS="false").
 * The server checks the password, two-factor code, account and organization status; the
 * token and user are stored by backendSession, and every API call is authorised by the server.
 */
export const backendAuthService: AuthService = {
  async login(email, password) {
    return authenticateWithBackend(email, password);
  },
  async restoreSession() {
    const user = readStoredBackendUser();
    // An expired or revoked token is detected by the first API call, which signs the user out.
    return { user: user ? { ...user, branchIds: [...(user.branchIds ?? [])] } : null, remember: true, expired: false };
  },
  completeLogin() {
    // The session was stored when the server accepted the sign-in.
  },
  logout() {
    revokeBackendSession();
    clearPendingChallenge();
    clearBackendSession();
    try {
      localStorage.removeItem(BRANCH_KEY);
    } catch {
      // storage unavailable
    }
  },
  requiresCaptcha: () => false,
  requiresMfa: (user) => backendMfaEnabled(user.id) && !readStoredBackendUser(),
  verifyCaptcha: async () => undefined,
  async verifyMfa(code) {
    await verifyBackendMfa(code);
  },
  resendMfaCode: async () => undefined,
  getSelectedBranch() {
    try {
      return localStorage.getItem(BRANCH_KEY);
    } catch {
      return null;
    }
  },
  setSelectedBranch(branchId) {
    try {
      if (branchId) localStorage.setItem(BRANCH_KEY, branchId);
      else localStorage.removeItem(BRANCH_KEY);
    } catch {
      // storage unavailable
    }
  },
};
