import type { DocumentRecord } from '@/shared/types/document-record';

export const supportCategories = ['login_access', 'billing_subscription', 'pos', 'sales', 'purchase', 'inventory_stock', 'accounting', 'hr', 'projects', 'integrations', 'other'] as const;
export const supportPriorities = ['low', 'medium', 'high', 'urgent'] as const;
export const supportStatuses = ['open', 'in_progress', 'waiting_for_user', 'resolved', 'closed'] as const;
export const supportModules = ['general', 'auth', 'billing', 'pos', 'sales', 'purchasing', 'inventory', 'accounting', 'hr', 'projects', 'integrations'] as const;

export type SupportCategory = typeof supportCategories[number];
export type SupportPriority = typeof supportPriorities[number];
export type SupportStatus = typeof supportStatuses[number];
export type SupportRelatedModule = typeof supportModules[number];
export type SupportAuthorType = 'tenant_user' | 'quick_erp_support';

export interface SupportActor { id: string; name: string; email?: string }
export interface SupportConversationMessage { id: string; author: SupportActor; authorType: SupportAuthorType; message: string; attachmentIds: string[]; createdAt: string }
export interface SupportTimelineEvent { id: string; status: SupportStatus; label: string; actorName: string; createdAt: string }

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  tenantId: string;
  branchId?: string;
  createdBy: SupportActor;
  subject: string;
  description: string;
  category: SupportCategory;
  priority: SupportPriority;
  status: SupportStatus;
  relatedModule?: SupportRelatedModule;
  relatedRecordId?: string;
  relatedRecordReference?: string;
  assignedSupportUser?: SupportActor;
  attachmentIds: string[];
  conversation: SupportConversationMessage[];
  timeline: SupportTimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketDetail extends SupportTicket { attachments: DocumentRecord[] }
export interface CreateSupportTicketRequest { subject: string; description: string; category: SupportCategory; priority: SupportPriority; branchId?: string; relatedModule?: SupportRelatedModule; relatedRecordId?: string; relatedRecordReference?: string }
export interface CreateSupportTicketCommand { input: CreateSupportTicketRequest; attachments: File[] }
export interface AddSupportReplyRequest { ticketId: string; message: string; attachments: File[] }
export interface UpdateSupportStatusRequest { ticketId: string; status: SupportStatus }
export interface UpdateSupportPriorityRequest { ticketId: string; priority: SupportPriority }
export interface SupportTicketFilters { search?: string; status?: SupportStatus | 'all'; priority?: SupportPriority | 'all'; category?: SupportCategory | 'all'; relatedModule?: SupportRelatedModule | 'all'; branchId?: string | 'all'; createdBy?: string; dateFrom?: string; dateTo?: string; sortField?: 'createdAt' | 'updatedAt' | 'priority' | 'status' | 'ticketNumber'; sortOrder?: 'asc' | 'desc'; page?: number; pageSize?: number }
export interface SupportTicketListResponse { data: SupportTicket[]; total: number; page: number; pageSize: number }
export interface SupportDashboardResponse { open: number; inProgress: number; waitingForUser: number; resolved: number; closed: number; highPriority: number; recentActivity: Array<{ ticketId: string; ticketNumber: string; subject: string; action: string; at: string }> }
export interface SupportScope { tenantId: string; activeBranchId: string; permittedBranchIds: string[]; user: SupportActor; permissions: string[] }
