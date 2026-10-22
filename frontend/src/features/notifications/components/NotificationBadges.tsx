import { StatusBadge } from '@/shared/components/common/StatusBadge';
import type { NotificationPriority, NotificationType } from '../types/notifications';

export function PriorityBadge({ priority }: { priority: NotificationPriority }) { return <StatusBadge status={priority} tone={priority === 'urgent' ? 'danger' : priority === 'high' ? 'warning' : priority === 'normal' ? 'info' : 'default'} />; }
export function NotificationTypeBadge({ type }: { type: NotificationType }) { return <StatusBadge status={type} tone={type === 'success' ? 'success' : type === 'alert' ? 'danger' : type === 'approval' ? 'warning' : type === 'reminder' ? 'info' : 'default'} />; }
