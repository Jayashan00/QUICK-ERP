export const tenantSettingsKeys = {
  all: ['settings', 'tenant-configuration'] as const,
  general: (tenantId: string) => [...tenantSettingsKeys.all, tenantId, 'general'] as const,
  localization: (tenantId: string) => [...tenantSettingsKeys.all, tenantId, 'localization'] as const,
  financialYear: (tenantId: string) => [...tenantSettingsKeys.all, tenantId, 'financial-year'] as const,
  periods: (tenantId: string) => [...tenantSettingsKeys.all, tenantId, 'periods'] as const,
  taxes: (tenantId: string) => [...tenantSettingsKeys.all, tenantId, 'taxes'] as const,
  paymentTerms: (tenantId: string) => [...tenantSettingsKeys.all, tenantId, 'payment-terms'] as const,
  paymentMethods: (tenantId: string) => [...tenantSettingsKeys.all, tenantId, 'payment-methods'] as const,
  sequences: (tenantId: string) => [...tenantSettingsKeys.all, tenantId, 'sequences'] as const,
  notifications: (tenantId: string, userId: string) => [...tenantSettingsKeys.all, tenantId, 'notifications', userId] as const,
};
