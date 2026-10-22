import { registerMap } from '@/core/persistence/stateRegistry';
import type { User } from '@/core/auth/types/user';
import { mockUsers } from '@/core/auth/mocks/users';
import { updateMockPassword, verifyMockPassword } from '@/core/auth/mocks/auth';
import {
  backendMfaEnabled,
  changeBackendPassword,
  confirmBackendPasswordReset,
  disableBackendMfa,
  enableBackendMfa,
  isBackendEnabled,
  loadBackendMfaStatus,
  requestBackendPasswordReset,
  startBackendMfaSetup,
  verifyBackendMfa,
  type MfaSetup,
} from '@/core/persistence/backendSession';

export type AuthChallenge = 'captcha' | 'mfa' | null;

export interface SecurityProfile {
  mfaEnabled: boolean;
  recoveryCodes: string[];
}

const profiles = new Map<string, SecurityProfile>(
  mockUsers.filter((user) => !user.isSuperAdmin).map((user) => [
    user.id,
    { mfaEnabled: user.id === 'usr-001', recoveryCodes: [] },
  ]),
);

const wait = (duration = 300) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, duration));
let pendingResetUserId: string | null = null;

export const MOCK_CAPTCHA_ANSWER = 'ERP38';
export const MOCK_MFA_CODE = '123456';

export const securityService = {
  requiresCaptcha(user: User) {
    // Backend mode protects sign-in with server-side rate limits and account lockout instead.
    if (isBackendEnabled()) return false;
    return !user.isSuperAdmin;
  },
  getProfile(userId: string): SecurityProfile {
    if (isBackendEnabled()) return { mfaEnabled: backendMfaEnabled(userId), recoveryCodes: [] };
    const profile = profiles.get(userId) ?? { mfaEnabled: false, recoveryCodes: [] };
    return { ...profile, recoveryCodes: [...profile.recoveryCodes] };
  },
  async verifyCaptcha(answer: string) {
    await wait();
    if (answer.trim().toUpperCase() !== MOCK_CAPTCHA_ANSWER) throw new Error('The security answer is incorrect. Try the refreshed challenge.');
  },
  async verifyMfa(code: string) {
    if (isBackendEnabled()) {
      await verifyBackendMfa(code);
      return;
    }
    await wait();
    if (code !== MOCK_MFA_CODE) throw new Error('The verification code is invalid or expired.');
  },
  async resendMfaCode() {
    // Authenticator apps generate codes on the phone, so there is nothing to resend in backend mode.
    await wait(450);
  },
  /** Backend mode: reads the current two-factor status from the server. */
  async loadProfile(userId: string): Promise<SecurityProfile> {
    if (isBackendEnabled()) await loadBackendMfaStatus(userId);
    return this.getProfile(userId);
  },
  /** Backend mode: creates the secret to add to an authenticator app. */
  async startMfaSetup(): Promise<MfaSetup> {
    return startBackendMfaSetup();
  },
  async requestPasswordReset(email: string) {
    if (isBackendEnabled()) {
      await requestBackendPasswordReset(email);
      return;
    }
    await wait(450);
    pendingResetUserId = mockUsers.find((user) => !user.isSuperAdmin && user.email.toLowerCase() === email.trim().toLowerCase())?.id ?? null;
  },
  async resetPassword(token: string, password: string) {
    await wait(450);
    if (isBackendEnabled()) {
      if (!token) throw new Error('This password reset link is invalid or expired.');
      await confirmBackendPasswordReset(token, password);
      return;
    }
    if (!token || token === 'expired') throw new Error('This password reset link is invalid or expired.');
    if (!password) throw new Error('A new password is required.');
    if (pendingResetUserId) updateMockPassword(pendingResetUserId, password);
    pendingResetUserId = null;
  },
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (isBackendEnabled()) {
      if (currentPassword === newPassword) throw new Error('The new password must be different from the current password.');
      await changeBackendPassword(currentPassword, newPassword);
      return;
    }
    await wait(450);
    if (!verifyMockPassword(userId, currentPassword)) throw new Error('The current password is incorrect.');
    if (currentPassword === newPassword) throw new Error('The new password must be different from the current password.');
    updateMockPassword(userId, newPassword);
  },
  async enableMfa(userId: string, code: string) {
    if (isBackendEnabled()) return enableBackendMfa(userId, code);
    await this.verifyMfa(code);
    const recoveryCodes = ['QERP-38A7', 'QERP-92KD', 'QERP-7MX4', 'QERP-4PL8'];
    profiles.set(userId, { mfaEnabled: true, recoveryCodes });
    return [...recoveryCodes];
  },
  async disableMfa(userId: string, code: string) {
    if (isBackendEnabled()) {
      await disableBackendMfa(userId, code);
      return;
    }
    await this.verifyMfa(code);
    profiles.set(userId, { mfaEnabled: false, recoveryCodes: [] });
  },
};

// Backend persistence registration (see src/core/persistence).
registerMap('core.securityProfiles', profiles);
