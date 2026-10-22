import type { NotificationFilters } from '../types/notifications';

export const notificationKeys = {
  all: (tenantId: string) => ['notifications', tenantId] as const,
  list: (tenantId: string, userId: string, branchId: string, filters: NotificationFilters) => [...notificationKeys.all(tenantId), 'list', userId, branchId, filters] as const,
  recent: (tenantId: string, userId: string, branchId: string) => [...notificationKeys.all(tenantId), 'recent', userId, branchId] as const,
  notices: (tenantId: string, userId: string, includeInactive: boolean) => [...notificationKeys.all(tenantId), 'notices', userId, includeInactive] as const,
  templates: (tenantId: string) => [...notificationKeys.all(tenantId), 'templates'] as const,
};
