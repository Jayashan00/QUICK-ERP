import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import { roleKeys } from '@/core/permissions/roleKeys';
import { permissionMatrixService } from '@/features/settings/roles/services/permissionMatrixService';
import type { TenantModule } from '@/core/tenant/tenantEntitlements';

export function usePermissionMatrix(roleId: string) {
  const { tenantId, currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [initialPermissions, setInitialPermissions] = useState<string[]>([]);

  const enabledModules = useMemo<readonly TenantModule[]>(
    () => currentTenant?.entitlements.enabledModules ?? [],
    [currentTenant?.entitlements.enabledModules],
  );

  const catalogQuery = useQuery({
    queryKey: ['settings', 'permission-catalog', tenantId ?? '', enabledModules],
    queryFn: () => permissionMatrixService.getCatalog(tenantId ?? '', enabledModules),
    enabled: Boolean(tenantId),
  });

  const permissionsQuery = useQuery({
    queryKey: ['settings', 'role-permissions', tenantId ?? '', roleId, enabledModules],
    queryFn: () => {
      if (!tenantId || !roleId) return [];
      return permissionMatrixService.getRolePermissions(tenantId, roleId, enabledModules);
    },
    enabled: Boolean(tenantId && roleId),
  });

  useEffect(() => {
    const raw = permissionsQuery.data?.filter((permission) => permission !== '*') ?? [];
    setSelected(raw);
    setInitialPermissions(raw);
  }, [permissionsQuery.data, roleId]);

  const save = useMutation({
    mutationFn: () => {
      if (!tenantId || !roleId) throw new Error('Select a role before saving.');
      return permissionMatrixService.saveRolePermissions(tenantId, roleId, selected, enabledModules);
    },
    onSuccess: async (role) => {
      queryClient.setQueryData(roleKeys.detail(role.tenantId, role.id), role);
      setInitialPermissions([...selected]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: roleKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['settings', 'role-permissions', role.tenantId, role.id] }),
      ]);
    },
  });

  const hasChanges = useMemo(() => {
    if (selected.length !== initialPermissions.length) return true;
    const initialSet = new Set(initialPermissions);
    return selected.some((p) => !initialSet.has(p));
  }, [selected, initialPermissions]);

  const discardChanges = () => {
    setSelected([...initialPermissions]);
  };

  return {
    groups: catalogQuery.data ?? [],
    selected,
    setSelected,
    initialPermissions,
    hasChanges,
    discardChanges,
    enabledModules,
    isLoading: catalogQuery.isLoading || permissionsQuery.isLoading,
    error: catalogQuery.error || permissionsQuery.error ? 'Failed to load the permission matrix.' : null,
    save: save.mutateAsync,
    isSaving: save.isPending,
  };
}
