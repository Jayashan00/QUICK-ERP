export const loginActivityKeys = {
  all: ['settings', 'login-activity'] as const,
  sessions: (tenantId: string) => [...loginActivityKeys.all, tenantId, 'sessions'] as const,
};
