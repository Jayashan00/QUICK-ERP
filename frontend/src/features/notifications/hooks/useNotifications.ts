import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/auth/auth-context';
import { useBranch } from '@/core/branch/branch-context';
import { usePermissions } from '@/core/permissions/permission-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { notificationKeys } from '../queries/notificationKeys';
import { notificationService } from '../services/notificationService';
import type { NoticeInput, NotificationFilters, NotificationScope, NotificationTemplateInput } from '../types/notifications';

export function useNotificationScope() {
  const { user } = useAuth(); const { tenantId } = useTenant(); const { branchId, branches } = useBranch(); const { permissions } = usePermissions();
  const scope: NotificationScope | null = user && tenantId && branchId ? { tenantId, userId: user.id, activeBranchId: branchId, permittedBranchIds: branches.map((branch) => branch.id), permissions } : null;
  return scope;
}

export function useNotifications(filters: NotificationFilters = {}) {
  const scope = useNotificationScope();
  return useQuery({ queryKey: notificationKeys.list(scope?.tenantId ?? '', scope?.userId ?? '', scope?.activeBranchId ?? '', filters), queryFn: () => { if (!scope) throw new Error('Notification scope is unavailable.'); return notificationService.list(scope, filters); }, enabled: Boolean(scope), staleTime: 15_000 });
}

export function useRecentNotifications(enabled = true) {
  const scope = useNotificationScope();
  return useQuery({ queryKey: notificationKeys.recent(scope?.tenantId ?? '', scope?.userId ?? '', scope?.activeBranchId ?? ''), queryFn: () => { if (!scope) throw new Error('Notification scope is unavailable.'); return notificationService.list(scope, { branchId: scope.activeBranchId, page: 1, pageSize: 6 }); }, enabled: Boolean(scope && enabled), refetchInterval: 60_000 });
}

export function useNotificationActions() {
  const scope = useNotificationScope(); const client = useQueryClient();
  const invalidate = () => scope ? client.invalidateQueries({ queryKey: notificationKeys.all(scope.tenantId) }) : Promise.resolve();
  const markRead = useMutation({ mutationFn: ({ id, isRead }: { id: string; isRead?: boolean }) => { if (!scope) throw new Error('Notification scope is unavailable.'); return notificationService.markRead(scope, id, isRead); }, onSuccess: invalidate });
  const markAll = useMutation({ mutationFn: () => { if (!scope) throw new Error('Notification scope is unavailable.'); return notificationService.markAllRead(scope); }, onSuccess: invalidate });
  const archive = useMutation({ mutationFn: (id: string) => { if (!scope) throw new Error('Notification scope is unavailable.'); return notificationService.archive(scope, id); }, onSuccess: invalidate });
  const restore = useMutation({ mutationFn: (id: string) => { if (!scope) throw new Error('Notification scope is unavailable.'); return notificationService.restore(scope, id); }, onSuccess: invalidate });
  return { markRead: markRead.mutateAsync, markAllRead: markAll.mutateAsync, archive: archive.mutateAsync, restore: restore.mutateAsync, isPending: markRead.isPending || markAll.isPending || archive.isPending || restore.isPending };
}

export function useNotices(includeInactive: boolean) { const scope = useNotificationScope(); return useQuery({ queryKey: notificationKeys.notices(scope?.tenantId ?? '', scope?.userId ?? '', includeInactive), queryFn: () => { if (!scope) throw new Error('Notification scope is unavailable.'); return notificationService.listNotices(scope, includeInactive); }, enabled: Boolean(scope) }); }
export function useNoticeActions() { const scope = useNotificationScope(); const { user } = useAuth(); const client = useQueryClient(); const invalidate = () => scope ? client.invalidateQueries({ queryKey: notificationKeys.all(scope.tenantId) }) : Promise.resolve(); const save = useMutation({ mutationFn: ({ input, id }: { input: NoticeInput; id?: string }) => { if (!scope || !user) throw new Error('Notification scope is unavailable.'); return notificationService.saveNotice(scope, user.id, input, id); }, onSuccess: invalidate }); const remove = useMutation({ mutationFn: (id: string) => { if (!scope) throw new Error('Notification scope is unavailable.'); return notificationService.removeNotice(scope, id); }, onSuccess: invalidate }); const acknowledge = useMutation({ mutationFn: (id: string) => { if (!scope) throw new Error('Notification scope is unavailable.'); return notificationService.acknowledgeNotice(scope, id); }, onSuccess: invalidate }); return { save: save.mutateAsync, remove: remove.mutateAsync, acknowledge: acknowledge.mutateAsync, isPending: save.isPending || remove.isPending || acknowledge.isPending }; }
export function useNotificationTemplates() { const scope = useNotificationScope(); return useQuery({ queryKey: notificationKeys.templates(scope?.tenantId ?? ''), queryFn: () => { if (!scope) throw new Error('Notification scope is unavailable.'); return notificationService.listTemplates(scope); }, enabled: Boolean(scope) }); }
export function useTemplateActions() { const scope = useNotificationScope(); const client = useQueryClient(); const invalidate = () => scope ? client.invalidateQueries({ queryKey: notificationKeys.templates(scope.tenantId) }) : Promise.resolve(); const save = useMutation({ mutationFn: ({ input, id }: { input: NotificationTemplateInput; id?: string }) => { if (!scope) throw new Error('Notification scope is unavailable.'); return notificationService.saveTemplate(scope, input, id); }, onSuccess: invalidate }); const remove = useMutation({ mutationFn: (id: string) => { if (!scope) throw new Error('Notification scope is unavailable.'); return notificationService.removeTemplate(scope, id); }, onSuccess: invalidate }); const test = useMutation({ mutationFn: (id: string) => { if (!scope) throw new Error('Notification scope is unavailable.'); return notificationService.sendTemplateTest(scope, id); } }); return { save: save.mutateAsync, remove: remove.mutateAsync, sendTest: test.mutateAsync, isPending: save.isPending || remove.isPending || test.isPending }; }
