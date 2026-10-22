import { BaseEntity, EntityId } from '@/shared/types/common';

export type NotificationType = 'info' | 'warning' | 'success' | 'danger';

export interface NotificationItem extends BaseEntity {
  tenantId: EntityId;
  userId: EntityId;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  link?: string;
  module?: string;
}
