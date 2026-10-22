import { StatusBadge } from '@/shared/components/common/StatusBadge';
import type { SupportPriority, SupportStatus } from '../types/support';

export function SupportStatusBadge({ status }: { status: SupportStatus }) { return <StatusBadge status={status} />; }
export function SupportPriorityBadge({ priority }: { priority: SupportPriority }) { return <StatusBadge status={priority} variant={priority === 'urgent' || priority === 'high' ? 'danger' : priority === 'medium' ? 'warning' : 'info'} />; }
