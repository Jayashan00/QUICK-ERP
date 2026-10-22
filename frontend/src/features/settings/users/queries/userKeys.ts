import type { GetUsersParams } from '@/core/auth/userService';
export const userKeys = {
  all: ['settings', 'users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (tenantId: string, params: GetUsersParams) => [...userKeys.lists(), tenantId, params] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (tenantId: string, id: string) => [...userKeys.details(), tenantId, id] as const,
};
