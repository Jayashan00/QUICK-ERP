import { BaseEntity, EntityId } from '@/shared/types/common';

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'invited';

export interface User extends BaseEntity {
  name: string;
  email: string;
  avatarUrl?: string;
  roleId: EntityId;
  roleName: string;
  tenantId: EntityId;
  branchIds: EntityId[];
  defaultBranchId: EntityId;
  status: UserStatus;
  phone?: string;
  departmentId?: EntityId;
  department?: string;
  designationId?: EntityId;
  designation?: string;
  jobTitle?: string;
  isSuperAdmin?: boolean;
}
