import type { ApprovalRecord } from '@/shared/types/approval';

export const mockApprovalRecord: ApprovalRecord = {
  status: 'pending',
  submittedAt: '2026-09-22T08:00:00Z',
  submittedBy: 'Sales Manager',
  history: [
    { id: 'approval-history-001', status: 'pending', actorId: 'usr-002', actorName: 'Sales Manager', timestamp: '2026-09-22T08:00:00Z', remarks: 'Submitted for commercial approval.' },
  ],
};
