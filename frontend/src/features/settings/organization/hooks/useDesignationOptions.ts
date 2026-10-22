import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/core/tenant/tenant-context';
import { designationKeys } from '@/features/settings/organization/queries/designationKeys';
import { designationService } from '@/features/settings/organization/services/designationService';
export function useDesignationOptions(departmentId?: string, includeInactive = false) { const { tenantId } = useTenant(); const query = useQuery({ queryKey: designationKeys.options(tenantId ?? ''), queryFn: () => { if (!tenantId) throw new Error('Tenant context is unavailable.'); return designationService.getAllDesignations(tenantId); }, enabled: Boolean(tenantId) }); const designations = useMemo(() => (query.data ?? []).filter((item) => (includeInactive || item.status === 'active') && (!departmentId || item.departmentId === departmentId)), [departmentId, includeInactive, query.data]); return { designations, isLoading: query.isLoading, error: query.error ? 'Failed to load designation options.' : null }; }
