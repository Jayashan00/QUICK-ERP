import type { GetRolesParams } from '@/core/permissions/roleService';
export const roleKeys = {
  all: ['settings', 'roles'] as const,
  options: (tenantId: string) => [...roleKeys.all, 'options', tenantId] as const,
  lists: () => [...roleKeys.all, 'list'] as const,
  list: (tenantId: string, params: GetRolesParams) => [...roleKeys.lists(), tenantId, params] as const,
  details: () => [...roleKeys.all, 'detail'] as const,
  detail: (tenantId: string, id: string) => [...roleKeys.details(), tenantId, id] as const,
};
