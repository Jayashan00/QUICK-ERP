import type { GetSuppliersParams } from '../services/supplierService';

export const supplierKeys = {
  all: ['suppliers'] as const,

  lists: () => [...supplierKeys.all, 'list'] as const,

  list: (tenantId: string, params: GetSuppliersParams) =>
    [...supplierKeys.lists(), tenantId, params] as const,

  details: () => [...supplierKeys.all, 'detail'] as const,

  detail: (tenantId: string, id: string) =>
    [...supplierKeys.details(), tenantId, id] as const,

  documents: (tenantId: string, id: string) =>
    [...supplierKeys.detail(tenantId, id), 'documents'] as const,

  notes: (tenantId: string, id: string) =>
    [...supplierKeys.detail(tenantId, id), 'notes'] as const,

  activity: (tenantId: string, id: string) =>
    [...supplierKeys.detail(tenantId, id), 'activity'] as const,

  purchaseHistory: (tenantId: string, id: string, branchId: string) =>
    [...supplierKeys.detail(tenantId, id), 'purchaseHistory', branchId] as const,

  transactions: (tenantId: string, id: string, branchId: string) =>
    [...supplierKeys.detail(tenantId, id), 'transactions', branchId] as const,

  balance: (tenantId: string, id: string) =>
    [...supplierKeys.detail(tenantId, id), 'balance'] as const,

  statement: (tenantId: string, id: string, startDate: string, endDate: string, branchId: string) =>
    [...supplierKeys.detail(tenantId, id), 'statement', startDate, endDate, branchId] as const,

  performance: (tenantId: string, id: string, branchId: string) =>
    [...supplierKeys.detail(tenantId, id), 'performance', branchId] as const,
};

