export const userOptionKeys = {
  all: ['settings', 'user-options'] as const,
  forTenant: (tenantId: string) => [...userOptionKeys.all, tenantId] as const,
};
