export type NotificationType = 'approval' | 'alert' | 'reminder' | 'success' | 'info';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationModule = 'sales' | 'purchasing' | 'inventory' | 'finance' | 'hr' | 'projects' | 'documents' | 'support' | 'sync' | 'system';
export type NotificationAudience = 'company' | 'branch' | 'user';
export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'whatsapp';

export interface NotificationRecord {
  id: string;
  tenantId: string;
  branchId?: string;
  userId?: string;
  audience: NotificationAudience;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  module: NotificationModule;
  relatedEntity?: string;
  relatedRecordId?: string;
  reference?: string;
  actionLabel?: string;
  actionUrl?: string;
  requiredPermission?: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
  archivedAt?: string;
  sourceKey?: string;
}

export interface NotificationScope {
  tenantId: string;
  userId: string;
  activeBranchId: string;
  permittedBranchIds: string[];
  permissions: string[];
}

export interface NotificationFilters {
  search?: string;
  archiveState?: 'active' | 'archived';
  readState?: 'all' | 'unread' | 'read';
  type?: NotificationType | 'all';
  priority?: NotificationPriority | 'all';
  module?: NotificationModule | 'all';
  branchId?: string | 'all';
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface NotificationListResult {
  data: NotificationRecord[];
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
}

export type NoticeAudience = 'company' | 'branch' | 'users';
export interface Notice {
  id: string;
  tenantId: string;
  title: string;
  message: string;
  audience: NoticeAudience;
  branchId?: string;
  userIds: string[];
  priority: NotificationPriority;
  publishDate: string;
  expiryDate?: string;
  isActive: boolean;
  acknowledgementRequired: boolean;
  acknowledgedBy: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoticeInput {
  title: string;
  message: string;
  audience: NoticeAudience;
  branchId?: string;
  userIds: string[];
  priority: NotificationPriority;
  publishDate: string;
  expiryDate?: string;
  isActive: boolean;
  acknowledgementRequired: boolean;
}

export interface NotificationTemplate {
  id: string;
  tenantId: string;
  name: string;
  eventType: string;
  subject: string;
  body: string;
  channel: NotificationChannel;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NotificationTemplateInput = Omit<NotificationTemplate, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>;
