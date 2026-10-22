export const companyKeys = {
  all: ['settings', 'company'] as const,
  profile: (tenantId: string) => [...companyKeys.all, tenantId] as const,
};
