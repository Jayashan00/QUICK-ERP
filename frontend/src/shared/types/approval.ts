import type { EntityId } from '@/shared/types/common';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalHistoryEntry {
  id: EntityId;
  status: ApprovalStatus;
  actorId: EntityId;
  actorName: string;
  timestamp: string;
  remarks?: string;
}

export interface ApprovalRecord {
  status: ApprovalStatus;
  submittedAt?: string;
  submittedBy?: string;
  history: ApprovalHistoryEntry[];
}
