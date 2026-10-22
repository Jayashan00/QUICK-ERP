import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import { designationKeys } from '@/features/settings/organization/queries/designationKeys';
import { designationService } from '@/features/settings/organization/services/designationService';
export function useDesignation(id?: string) { const { tenantId } = useTenant(); const query = useQuery({ queryKey: designationKeys.detail(tenantId ?? '', id ?? ''), queryFn: () => tenantId && id ? designationService.getDesignationById(tenantId, id) : null, enabled: Boolean(tenantId && id) }); return { designation: query.data ?? null, isLoading: query.isLoading, error: query.error ? 'Failed to load designation.' : null, refetch: query.refetch }; }
