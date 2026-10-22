import type { GetDepartmentsParams } from '@/features/settings/organization/services/departmentService';

export const departmentKeys = {
  all: ['settings', 'departments'] as const,
  options: (tenantId: string) => [...departmentKeys.all, 'options', tenantId] as const,
  lists: () => [...departmentKeys.all, 'list'] as const,
  list: (tenantId: string, params: GetDepartmentsParams) =>
    [...departmentKeys.lists(), tenantId, params] as const,
  details: () => [...departmentKeys.all, 'detail'] as const,
  detail: (tenantId: string, id: string) =>
    [...departmentKeys.details(), tenantId, id] as const,
};
