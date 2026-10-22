import type { GetDesignationsParams } from '@/features/settings/organization/services/designationService';
export const designationKeys = {
  all: ['settings', 'designations'] as const,
  options: (tenantId: string) => [...designationKeys.all, 'options', tenantId] as const,
  lists: () => [...designationKeys.all, 'list'] as const,
  list: (tenantId: string, params: GetDesignationsParams) => [...designationKeys.lists(), tenantId, params] as const,
  details: () => [...designationKeys.all, 'detail'] as const,
  detail: (tenantId: string, id: string) => [...designationKeys.details(), tenantId, id] as const,
};
