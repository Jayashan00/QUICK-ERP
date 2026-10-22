import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useTenant } from '@/core/tenant/tenant-context';
import type { User } from '@/core/auth/types/user';
import { roleKeys } from '@/core/permissions/roleKeys';
import { userKeys } from '@/features/settings/users/queries/userKeys';
import { userOptionKeys } from '@/features/settings/users/queries/userOptionKeys';
import { userService, type CreateUserInput, type GetUsersParams } from '@/core/auth/userService';

export function useUsers(initial: GetUsersParams = {}) {
  const { tenantId } = useTenant(); const queryClient = useQueryClient();
  const [search, setSearchState] = useState(initial.search ?? ''); const [status, setStatusState] = useState(initial.status ?? 'all'); const [roleId, setRoleIdState] = useState(initial.roleId ?? 'all'); const [branchId, setBranchIdState] = useState(initial.branchId ?? 'all'); const [departmentId, setDepartmentIdState] = useState(initial.departmentId ?? 'all'); const [page, setPage] = useState(initial.page ?? 1); const [pageSize, setPageSize] = useState(initial.pageSize ?? 10);
  const params = { search: useDebounce(search, 300), status, roleId, branchId, departmentId, page, pageSize };
  const query = useQuery({ queryKey: userKeys.list(tenantId ?? '', params), queryFn: () => { if (!tenantId) throw new Error('Tenant context is unavailable.'); return userService.getUsers(tenantId, params); }, enabled: Boolean(tenantId), placeholderData: keepPreviousData });
  const invalidate = () => Promise.all([queryClient.invalidateQueries({ queryKey: userKeys.all }), queryClient.invalidateQueries({ queryKey: userOptionKeys.all }), queryClient.invalidateQueries({ queryKey: roleKeys.all })]);
  const create = useMutation({ mutationFn: (data: CreateUserInput) => { if (!tenantId) throw new Error('Tenant context is unavailable.'); return userService.createUser(tenantId, data); }, onSuccess: invalidate });
  const update = useMutation({ mutationFn: ({ id, data }: { id: string; data: Partial<User> }) => { if (!tenantId) throw new Error('Tenant context is unavailable.'); return userService.updateUser(tenantId, id, data); }, onSuccess: (user) => { queryClient.setQueryData(userKeys.detail(user.tenantId, user.id), user); return invalidate(); } });
  const remove = useMutation({ mutationFn: (id: string) => { if (!tenantId) throw new Error('Tenant context is unavailable.'); return userService.deleteUser(tenantId, id); }, onSuccess: invalidate });
  return { users: query.data?.data ?? [], total: query.data?.total ?? 0, isLoading: query.isLoading, error: query.error ? 'Failed to load users.' : null, refetch: query.refetch, search, setSearch: (value: string) => { setSearchState(value); setPage(1); }, status, setStatus: (value: string) => { setStatusState(value); setPage(1); }, roleId, setRoleId: (value: string) => { setRoleIdState(value); setPage(1); }, branchId, setBranchId: (value: string) => { setBranchIdState(value); setPage(1); }, departmentId, setDepartmentId: (value: string) => { setDepartmentIdState(value); setPage(1); }, page, setPage, pageSize, setPageSize, createUser: create.mutateAsync, updateUser: (id: string, data: Partial<User>) => update.mutateAsync({ id, data }), deleteUser: remove.mutateAsync, isSaving: create.isPending || update.isPending, isDeleting: remove.isPending };
}
