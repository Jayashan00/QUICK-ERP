import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { DataTable } from '@/shared/components/tables/DataTable';
import type { Column } from '@/shared/components/tables/TableHeader';
import type { PlatformTenant } from '@/features/platform/types/platform';
import { usePlatformFoundation } from '@/features/platform/hooks/usePlatformFoundation';
export function UsagePage() { const query = usePlatformFoundation(); const columns: Column<PlatformTenant>[] = [
  { key: 'tenant', header: 'Company', render: (tenant) => <strong>{tenant.name}</strong> },
  { key: 'users', header: 'Users', render: (tenant) => `${tenant.usage.currentUsers} / ${tenant.limits.maxUsers}` },
  { key: 'branches', header: 'Branches', render: (tenant) => `${tenant.usage.currentBranches} / ${tenant.limits.maxBranches}` },
  { key: 'storage', header: 'Storage', render: (tenant) => tenant.limits.maxStorageGb ? `${tenant.usage.storageGb ?? 0} / ${tenant.limits.maxStorageGb} GB` : 'Not limited' },
  { key: 'modules', header: 'Enabled modules', render: (tenant) => tenant.enabledModules.length },
]; return <PageContainer><PageHeader title="Tenant Usage & Limits" description="Current company usage against limits assigned directly by Quick Solutions." /><DataTable columns={columns} data={query.data?.tenants ?? []} keyField="id" isLoading={query.isLoading} emptyTitle="No usage records" /></PageContainer>; }
