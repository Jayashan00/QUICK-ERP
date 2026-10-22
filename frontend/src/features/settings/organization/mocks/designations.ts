import type { Designation } from '@/features/settings/organization/types/designation';

export const mockDesignations: Designation[] = [
  { id: 'des-005', tenantId: 'tenant-001', name: 'Senior Engineer', code: 'SR-ENG', departmentId: 'dept-001', departmentName: 'Engineering', status: 'active', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'des-001', tenantId: 'tenant-001', name: 'System Administrator', code: 'SYS-ADMIN', departmentId: 'dept-003', departmentName: 'Administration & Operations', description: 'Owns tenant administration and system configuration.', status: 'active', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'des-002', tenantId: 'tenant-001', name: 'Sales Manager', code: 'SALES-MGR', departmentId: 'dept-002', departmentName: 'Sales & Business Development', description: 'Leads sales planning, coaching, and pipeline delivery.', status: 'active', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'des-003', tenantId: 'tenant-001', name: 'Sales Executive', code: 'SALES-EXEC', departmentId: 'dept-002', departmentName: 'Sales & Business Development', description: 'Manages prospects and customer opportunities.', status: 'active', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'des-004', tenantId: 'tenant-001', name: 'Senior Accountant', code: 'SR-ACCT', departmentId: 'dept-004', departmentName: 'Finance & Accounting', description: 'Maintains ledgers, receivables, and financial controls.', status: 'active', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];
