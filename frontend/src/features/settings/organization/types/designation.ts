import type { BaseEntity, EntityId } from '@/shared/types/common';

export type DesignationStatus = 'active' | 'inactive';

export interface Designation extends BaseEntity {
  tenantId: EntityId;
  name: string;
  code: string;
  departmentId: EntityId;
  departmentName: string;
  description?: string;
  status: DesignationStatus;
}
