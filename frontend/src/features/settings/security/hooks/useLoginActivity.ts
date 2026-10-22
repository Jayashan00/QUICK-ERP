import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/auth/auth-context';
import { useTenant } from '@/core/tenant/tenant-context';
import { loginActivityKeys } from '@/features/settings/security/queries/loginActivityKeys';
import { loginActivityService } from '@/features/settings/security/services/loginActivityService';
import { useBranch } from '@/core/branch/branch-context';
import { auditEventService } from '@/core/audit';
import { notificationService } from '@/features/notifications/services/notificationService';

export function useLoginSessions() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { branchId } = useBranch();
  const client = useQueryClient();
  const enabled = Boolean(tenantId && tenantId !== 'platform');
  const requireTenant = () => {
    if (!tenantId || tenantId === 'platform') {
      throw new Error('Tenant context is unavailable.');
    }
    return tenantId;
  };
  const key = loginActivityKeys.sessions(tenantId ?? '');
  const query = useQuery({
    queryKey: key,
    queryFn: () => loginActivityService.getSessions(requireTenant()),
    enabled,
  });
  const revoke = useMutation({
    mutationFn: (sessionId: string) =>
      loginActivityService.revokeSession(requireTenant(), sessionId),
    onSuccess: async (session) => {
      if (tenantId && user) auditEventService.record({ tenantId, branchId: branchId ?? undefined, actorId: user.id, actorName: user.name, module: 'security', entityType: 'User Session', entityId: session.id, reference: session.userEmail, action: 'Session revoked', description: `${user.name} revoked a login session for ${session.userName}.`, relatedRoute: '/settings/login-activity', sensitivity: 'security' });
      if (tenantId) await notificationService.publish({ tenantId, branchId: branchId ?? undefined, userId: session.userId, audience: 'user', title: 'Session revoked', message: `${session.device} was signed out by ${user?.name ?? 'an administrator'}.`, type: 'info', priority: 'high', module: 'system', relatedEntity: 'user_session', relatedRecordId: session.id, actionLabel: 'Review security', actionUrl: '/security', requiredPermission: 'notifications.view' });
      return client.invalidateQueries({ queryKey: key });
    },
  });
  const revokeOthers = useMutation({
    mutationFn: () => {
      const current = query.data?.find(
        (session) => session.isCurrent && session.userId === user?.id,
      );
      if (!user || !current) {
        throw new Error('Current session could not be identified.');
      }
      return loginActivityService.revokeOtherUserSessions(
        requireTenant(),
        user.id,
        current.id,
      );
    },
    onSuccess: (count) => {
      if (tenantId && user) auditEventService.record({ tenantId, branchId: branchId ?? undefined, actorId: user.id, actorName: user.name, module: 'security', entityType: 'User Session', entityId: user.id, reference: user.email, action: 'Sessions revoked', description: `${user.name} revoked ${count} other active session${count === 1 ? '' : 's'}.`, relatedRoute: '/settings/login-activity', sensitivity: 'security' });
      return client.invalidateQueries({ queryKey: key });
    },
  });
  return {
    sessions: query.data ?? [],
    currentUserId: user?.id ?? '',
    isLoading: query.isLoading,
    error: query.error ? 'Failed to load login activity.' : null,
    refetch: query.refetch,
    revoke: revoke.mutateAsync,
    revokeOthers: revokeOthers.mutateAsync,
    isRevoking: revoke.isPending || revokeOthers.isPending,
  };
}
