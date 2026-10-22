import type { EntityId } from '@/shared/types/common';

export type LoginSessionStatus = 'active' | 'revoked' | 'expired' | 'failed';

export interface LoginSession {
  id: EntityId;
  tenantId: EntityId;
  userId: EntityId;
  userName: string;
  userEmail: string;
  device: string;
  browser: string;
  ipAddress: string;
  location: string;
  loginAt: string;
  lastActivityAt: string;
  status: LoginSessionStatus;
  isCurrent: boolean;
}
