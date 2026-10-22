export const deviceSettingsKeys = {
  all: ['settings', 'devices'] as const,
  detail: (tenantId: string, branchId: string, device: string) => [...deviceSettingsKeys.all, tenantId, branchId, device] as const,
  options: (tenantId: string, branchId: string, type: string) => [...deviceSettingsKeys.all, tenantId, branchId, 'options', type] as const,
};
