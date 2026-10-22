import type {
  BaseEntity,
  EntityId,
} from '@/shared/types/common';

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "unqualified"
  | "converted"
  | "lost";

export type LeadSource =
  | "website"
  | "referral"
  | "social_media"
  | "email"
  | "phone"
  | "event"
  | "advertisement"
  | "other";

export type LeadLostReason =
  | "price"
  | "competitor"
  | "timing"
  | "no_budget"
  | "no_response"
  | "not_a_fit"
  | "other";

export interface Lead
  extends BaseEntity {
  tenantId: EntityId;
  branchId: EntityId;

  code: string;

  firstName: string;
  lastName: string;

  company?: string;

  email: string;
  phone: string;

  source: LeadSource;
  status: LeadStatus;

  assignedTo?: EntityId;

  estimatedValue?: number;

  nextFollowUpAt?: string;

  notes?: string;

  lostReason?: LeadLostReason;
  lostNote?: string;

  convertedCustomerId?: EntityId;
  convertedAt?: string;
}
