import { authenticateMockUser } from './mocks/auth';
import { mockUsers } from './mocks/users';
import { clearMockSession, readMockSession, updateMockSessionBranch, writeMockSession } from './mockSession';
import { securityService } from './securityService';
import { auditEventService } from '@/core/audit';
import type { User } from './types/user';
import type { AuthService } from './types/authService';

function recordSession(user: User, action: string, description: string) {
  if (user.isSuperAdmin) return;
  auditEventService.record({ tenantId: user.tenantId, branchId: user.defaultBranchId, actorId: user.id, actorName: user.name, module: 'security', entityType: 'User Session', entityId: user.id, reference: user.email, action, description, relatedRoute: '/settings/login-activity', sensitivity: 'security' });
}

export const mockAuthService: AuthService = {
  async login(email, password) {
    try { return await authenticateMockUser(email, password); }
    catch (error) {
      const candidate = mockUsers.find(user => !user.isSuperAdmin && user.email.toLowerCase() === email.trim().toLowerCase());
      if (candidate) recordSession(candidate, 'Login failed', 'A mock login attempt failed for a known tenant user.');
      throw error;
    }
  },
  async restoreSession() {
    const restored = readMockSession();
    if (!restored) return { user: null, remember: false, expired: false };
    const user = mockUsers.find(candidate => candidate.id === restored.session.userId);
    const expiry = restored.session.expiresAt ? Date.parse(restored.session.expiresAt) : undefined;
    if (!user || user.status !== 'active' || (!user.isSuperAdmin && user.tenantId !== restored.session.tenantId) || (expiry !== undefined && (!Number.isFinite(expiry) || expiry <= Date.now()))) {
      clearMockSession();
      return { user: null, remember: false, expired: true };
    }
    return { user: { ...user, branchIds: [...user.branchIds] }, remember: restored.location === 'local', expired: false };
  },
  completeLogin(user, remember) {
    writeMockSession(user, remember);
    recordSession(user, 'Logged in', 'User completed the frontend mock authentication flow.');
  },
  logout(user) {
    clearMockSession();
    if (user) recordSession(user, 'Logged out', 'User ended the frontend mock session.');
  },
  requiresCaptcha: user => securityService.requiresCaptcha(user),
  requiresMfa: user => securityService.getProfile(user.id).mfaEnabled,
  verifyCaptcha: answer => securityService.verifyCaptcha(answer),
  verifyMfa: code => securityService.verifyMfa(code),
  resendMfaCode: () => securityService.resendMfaCode(),
  getSelectedBranch: () => readMockSession()?.session.selectedBranchId ?? null,
  setSelectedBranch: branchId => updateMockSessionBranch(branchId),
};
