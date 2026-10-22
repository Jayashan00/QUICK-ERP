import { mockLoginSessions } from '@/features/settings/security/mocks/loginSessions';
import type { LoginSession } from '@/features/settings/security/types/login-session';
import { registerList } from '@/core/persistence/stateRegistry';

let sessionStore = mockLoginSessions.map((session) => ({ ...session }));
const wait = (duration = 180) => new Promise((resolve) => setTimeout(resolve, duration));

export const loginActivityService = {
  async getSessions(tenantId: string): Promise<LoginSession[]> {
    await wait();
    return sessionStore
      .filter((session) => session.tenantId === tenantId)
      .map((session) => ({ ...session }));
  },

  async revokeSession(tenantId: string, sessionId: string): Promise<LoginSession> {
    await wait(240);
    const index = sessionStore.findIndex(
      (session) => session.tenantId === tenantId && session.id === sessionId,
    );
    if (index < 0) throw new Error('Session not found.');
    if (sessionStore[index].isCurrent) {
      throw new Error('The current session cannot be revoked from this page.');
    }
    if (sessionStore[index].status !== 'active') {
      throw new Error('This session is no longer active.');
    }
    sessionStore[index] = { ...sessionStore[index], status: 'revoked' };
    return { ...sessionStore[index] };
  },

  async revokeOtherUserSessions(
    tenantId: string,
    userId: string,
    currentSessionId: string,
  ): Promise<number> {
    await wait(300);
    let revoked = 0;
    sessionStore = sessionStore.map((session) => {
      if (
        session.tenantId === tenantId &&
        session.userId === userId &&
        session.id !== currentSessionId &&
        session.status === 'active'
      ) {
        revoked += 1;
        return { ...session, status: 'revoked' };
      }
      return session;
    });
    return revoked;
  },
};

// Backend persistence registration (see src/core/persistence).
registerList('settings.loginSessions', () => sessionStore, (rows) => { sessionStore = rows; });
