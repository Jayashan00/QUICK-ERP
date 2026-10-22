import type { SupportTicketFilters } from '../types/support';

export const supportKeys = {
  all: (tenantId: string) => ['support', tenantId] as const,
  dashboard: (tenantId: string, userId: string, branchIds: string[]) => [...supportKeys.all(tenantId), 'dashboard', userId, branchIds] as const,
  list: (tenantId: string, userId: string, branchIds: string[], filters: SupportTicketFilters) => [...supportKeys.all(tenantId), 'list', userId, branchIds, filters] as const,
  detail: (tenantId: string, userId: string, ticketId: string) => [...supportKeys.all(tenantId), 'detail', userId, ticketId] as const,
};
