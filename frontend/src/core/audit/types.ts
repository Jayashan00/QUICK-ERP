export type AuditModule =
  | 'sales'
  | 'purchases'
  | 'inventory'
  | 'accounting'
  | 'hr'
  | 'projects'
  | 'documents'
  | 'support'
  | 'security'
  | 'settings';

export type AuditSensitivity = 'normal' | 'sensitive' | 'security';
export type AuditValue = string | number | boolean | null;
export type AuditValues = Record<string, AuditValue>;

export interface TenantAuditEntry {
  id: string;
  tenantId: string;
  branchId?: string;
  actorId: string;
  actorName: string;
  module: AuditModule;
  entityType: string;
  entityId: string;
  reference: string;
  action: string;
  description: string;
  previousValues?: AuditValues;
  newValues?: AuditValues;
  remarks?: string;
  createdAt: string;
  relatedRoute?: string;
  sensitivity: AuditSensitivity;
}

export type CreateAuditEventInput = Omit<TenantAuditEntry, 'id' | 'createdAt' | 'sensitivity'> & {
  id?: string;
  createdAt?: string;
  sensitivity?: AuditSensitivity;
};

export interface AuditAccessScope {
  tenantId: string;
  permittedBranchIds: string[];
  canView: boolean;
  canExport: boolean;
  canViewSensitive: boolean;
  canViewSecurity: boolean;
}

export interface AuditFilters {
  search?: string;
  userId?: string;
  module?: string;
  action?: string;
  branchId?: string;
  sensitivity?: string;
  dateFrom?: string;
  dateTo?: string;
  sortField?: 'createdAt' | 'actorName' | 'module' | 'action' | 'reference';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface AuditPage {
  data: TenantAuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}
