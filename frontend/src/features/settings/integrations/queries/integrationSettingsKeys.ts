export const integrationSettingsKeys = {
  all: ['settings', 'tenant-integrations'] as const,
  email: (tenantId: string) => [...integrationSettingsKeys.all, tenantId, 'email'] as const,
  sms: (tenantId: string) => [...integrationSettingsKeys.all, tenantId, 'sms'] as const,
  whatsapp: (tenantId: string) => [...integrationSettingsKeys.all, tenantId, 'whatsapp'] as const,
  settlementBank: (tenantId: string) => [...integrationSettingsKeys.all, tenantId, 'settlement-bank'] as const,
};
