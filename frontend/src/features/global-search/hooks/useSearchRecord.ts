import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useTenant } from '@/core/tenant/tenant-context';
import { useBranch } from '@/core/branch/branch-context';
import { usePermissions } from '@/core/permissions/permission-context';
import type { TenantBranchScope } from '@/core/tenant/dataScope';

export function useSearchRecord<T>(source: string, permission: string, load: (scope: TenantBranchScope, id: string) => Promise<T | null>) {
  const [params, setParams] = useSearchParams();
  const recordId = params.get('record');
  const { tenantId } = useTenant(); const { branchId } = useBranch(); const { hasPermission } = usePermissions();
  const canView = hasPermission(permission);
  const scope = { tenantId: tenantId ?? '', branchId: branchId ?? '' };
  const query = useQuery({ queryKey: [source, 'detail', scope, recordId], queryFn: () => load(scope, recordId ?? ''), enabled: Boolean(recordId && tenantId && branchId && canView) });
  const clearRecord = useCallback(() => { const next = new URLSearchParams(params); next.delete('record'); setParams(next, { replace: true }); }, [params, setParams]);
  return { recordId, record: canView ? query.data ?? null : null, clearRecord, initialSearch: params.get('search') ?? '', isLoading: query.isLoading, unavailable: query.isError || query.isSuccess && !query.data };
}
