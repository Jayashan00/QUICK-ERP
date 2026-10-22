import { BaseEntity, EntityId } from '@/shared/types/common';
import type { PermissionScope } from '@/core/permissions/permissionScope';

export interface Role extends BaseEntity {
  name: string;
  code: string;
  description?: string;
  tenantId: EntityId;
  scope: PermissionScope;
  permissions: string[];
  isSystem?: boolean;
  isActive?: boolean;
}
