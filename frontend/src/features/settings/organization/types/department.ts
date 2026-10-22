import { BaseEntity, EntityId } from '@/shared/types/common';

export type DepartmentStatus = 'active' | 'inactive';

export interface Department extends BaseEntity {
  tenantId: EntityId;
  name: string;
  code: string;
  description?: string;
  managerId?: EntityId;
  managerName?: string;
  branchId?: EntityId;
  branchName?: string;
  status: DepartmentStatus;
}
