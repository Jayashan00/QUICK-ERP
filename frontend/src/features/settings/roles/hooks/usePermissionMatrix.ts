import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import { roleKeys } from '@/core/permissions/roleKeys';
import { permissionMatrixService } from '@/features/settings/roles/services/permissionMatrixService';

export function usePermissionMatrix(roleId: string) {
  const { tenantId } = useTenant(); const queryClient = useQueryClient(); const [selected, setSelected] = useState<string[]>([]);
  const catalogQuery = useQuery({ queryKey: ['settings', 'permission-catalog', 'tenant'], queryFn: permissionMatrixService.getCatalog });
  const permissionsQuery = useQuery({ queryKey: ['settings', 'role-permissions', tenantId ?? '', roleId], queryFn: () => { if (!tenantId || !roleId) return []; return permissionMatrixService.getRolePermissions(tenantId, roleId); }, enabled: Boolean(tenantId && roleId) });
  useEffect(() => { setSelected(permissionsQuery.data?.filter((permission) => permission !== '*') ?? []); }, [permissionsQuery.data, roleId]);
  const save = useMutation({ mutationFn: () => { if (!tenantId || !roleId) throw new Error('Select a role before saving.'); return permissionMatrixService.saveRolePermissions(tenantId, roleId, selected); }, onSuccess: async (role) => { queryClient.setQueryData(roleKeys.detail(role.tenantId, role.id), role); await Promise.all([queryClient.invalidateQueries({ queryKey: roleKeys.all }), queryClient.invalidateQueries({ queryKey: ['settings', 'role-permissions', role.tenantId, role.id] })]); } });
  return { groups: catalogQuery.data ?? [], selected, setSelected, isLoading: catalogQuery.isLoading || permissionsQuery.isLoading, error: catalogQuery.error || permissionsQuery.error ? 'Failed to load the permission matrix.' : null, save: save.mutateAsync, isSaving: save.isPending };
}
