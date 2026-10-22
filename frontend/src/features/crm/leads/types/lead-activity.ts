import type {
  BaseEntity,
  EntityId,
} from '@/shared/types/common';

export type LeadActivityType =
  | "call"
  | "email"
  | "meeting"
  | "task"
  | "note";

export type LeadActivityStatus =
  | "planned"
  | "completed"
  | "cancelled";

export interface LeadActivity
  extends BaseEntity {
  tenantId: EntityId;
  branchId: EntityId;
  leadId: EntityId;

  type: LeadActivityType;
  status: LeadActivityStatus;

  subject: string;
  description?: string;

  scheduledAt?: string;
  completedAt?: string;

  assignedTo?: EntityId;
}
