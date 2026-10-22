import type { BaseEntity, EntityId } from '@/shared/types/common';

export type OpportunityStage =
  | 'prospecting'
  | 'qualification'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

export type OpportunityStatus =
  | 'open'
  | 'won'
  | 'lost'
  | 'closed';

export type OpportunityLostReason =
  | 'price'
  | 'competitor'
  | 'timing'
  | 'no_budget'
  | 'no_decision'
  | 'other';

export interface Opportunity extends BaseEntity {
  tenantId: EntityId;
  branchId: EntityId;
  code: string;
  name: string;

  customerId?: EntityId;
  customerName?: string;

  leadId?: EntityId;
  leadName?: string;

  salesOwnerId?: EntityId;
  salesOwnerName?: string;

  stage: OpportunityStage;
  status: OpportunityStatus;

  expectedCloseDate?: string;
  expectedValue: number;
  probability: number;

  description?: string;
  notes?: string;

  lostReason?: OpportunityLostReason;
  lostNote?: string;

  lastActivityAt?: string;
}

/** Ordered pipeline stages — the single source of truth for stage order and labels. */
export const OPPORTUNITY_STAGES: readonly { value: OpportunityStage; label: string }[] = [
  { value: 'prospecting', label: 'Prospecting' },
  { value: 'qualification', label: 'Qualification' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
] as const;

export const OPPORTUNITY_STATUSES: readonly { value: OpportunityStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'closed', label: 'Closed' },
] as const;
