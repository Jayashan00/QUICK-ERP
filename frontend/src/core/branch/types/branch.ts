import { BaseEntity, EntityId } from '@/shared/types/common';

export interface Branch extends BaseEntity {
  tenantId: EntityId;
  name: string;
  code: string;
  isMain: boolean;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  managerName?: string;
  managerId?: string;
  isActive: boolean;
}
