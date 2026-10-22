import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import type { Company } from '@/features/settings/company/types/company';
import { companyKeys } from '@/features/settings/company/queries/companyKeys';
import { companyService } from '@/features/settings/company/services/companyService';

export function useCompany() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  const companyQuery = useQuery({
    queryKey: companyKeys.profile(tenantId ?? ''),
    queryFn: () => {
      if (!tenantId) throw new Error('Tenant context is unavailable.');
      return companyService.getCompany(tenantId);
    },
    enabled: Boolean(tenantId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Company>) => {
      if (!tenantId) throw new Error('Tenant context is unavailable.');
      return companyService.updateCompany(tenantId, data);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(companyKeys.profile(updated.tenantId), updated);
    },
  });

  return {
    company: companyQuery.data ?? null,
    isLoading: companyQuery.isLoading,
    isFetching: companyQuery.isFetching,
    error: companyQuery.error ? 'Failed to load company profile.' : null,
    refetch: companyQuery.refetch,
    updateCompany: (data: Partial<Company>) => updateMutation.mutateAsync(data),
    isUpdating: updateMutation.isPending,
  };
}
