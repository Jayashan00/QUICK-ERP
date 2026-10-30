import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { platformTenantSchema } from '@/features/platform/schemas/platformSchemas';
import type { PlatformTenantInput } from '@/features/platform/types/platform';
import { platformService } from '@/features/platform/services/platformService';
import { usePlatformFoundation, usePlatformMutation } from '@/features/platform/hooks/usePlatformFoundation';
import { usePermissions } from '@/core/permissions/permission-context';
import { PLATFORM_PERMISSIONS } from '@/core/permissions';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { DataTable } from '@/shared/components/tables/DataTable';
import type { Column } from '@/shared/components/tables/TableHeader';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { Button } from '@/shared/components/common/Button';
import { Modal } from '@/shared/components/common/Modal';
import { FormField } from '@/shared/components/forms/FormField';
import { TextInput } from '@/shared/components/forms/TextInput';
import { Select } from '@/shared/components/forms/Select';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { appToast } from '@/shared/utils/toast';
import type { PlatformTenant } from '@/features/platform/types/platform';

const emptyTenant: PlatformTenantInput = { name: '', subdomain: '', ownerEmail: '', contactName: '', country: 'LK', adminName: '', adminEmail: '' };

export function TenantsPage() {
  const navigate = useNavigate();
  const query = usePlatformFoundation();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission(PLATFORM_PERMISSIONS.SUPER_ADMIN.TENANTS_CREATE);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [creating, setCreating] = useState(false);
  const form = useForm<PlatformTenantInput>({ resolver: zodResolver(platformTenantSchema), defaultValues: emptyTenant });
  const create = usePlatformMutation(platformService.createTenant);
  const rows = useMemo(() => (query.data?.tenants ?? []).filter((tenant) => (status === 'all' || tenant.status === status) && `${tenant.name} ${tenant.subdomain} ${tenant.admin.email}`.toLowerCase().includes(search.toLowerCase())), [query.data, search, status]);
  const columns: Column<PlatformTenant>[] = [
    { key: 'name', header: 'Company', render: (tenant) => <div><strong>{tenant.name}</strong><p className="text-xs text-slate-500">{tenant.subdomain}.quickerp.cloud</p></div> },
    { key: 'modules', header: 'Module access', render: (tenant) => `${tenant.enabledModules.length} modules` },
    { key: 'users', header: 'Users', render: (tenant) => `${tenant.usage.currentUsers} / ${tenant.limits.maxUsers}` },
    { key: 'branches', header: 'Branches', render: (tenant) => `${tenant.usage.currentBranches} / ${tenant.limits.maxBranches}` },
    { key: 'status', header: 'Status', render: (tenant) => <StatusBadge status={tenant.status} /> },
    { key: 'updatedAt', header: 'Updated', render: (tenant) => new Date(tenant.updatedAt).toLocaleDateString() },
  ];
  if (query.error) return <PageContainer><ErrorState message="Unable to load tenant companies." onRetry={() => void query.refetch()} /></PageContainer>;
  return <PageContainer>
    <PageHeader title="Companies & Tenants" description="Provision isolated companies and directly control their ERP modules and resource limits." actions={canCreate ? <Button leftIcon={<Plus size={16} />} onClick={() => { form.reset(emptyTenant); setCreating(true); }}>Create Company</Button> : undefined} />
    <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
      <TextInput aria-label="Search companies" placeholder="Search company, subdomain or tenant admin" value={search} onChange={(event) => setSearch(event.target.value)} />
      <Select value={status} onChange={(event) => setStatus(event.target.value)} options={[{ value: 'all', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }]} />
    </div>
    <DataTable columns={columns} data={rows} keyField="id" isLoading={query.isLoading} emptyTitle="No companies found" emptyMessage="Create a company or adjust the filters." onRowClick={(tenant) => navigate(`/super-admin/tenants/${tenant.id}`)} rowActions={(tenant) => [{ key: 'view', label: 'View and configure', onClick: () => navigate(`/super-admin/tenants/${tenant.id}`) }]} />
    <Modal isOpen={creating} title="Create company" onClose={() => setCreating(false)}>
      <form className="space-y-4" onSubmit={form.handleSubmit(async (values) => { try { const tenant = await create.mutateAsync(values); appToast.success('Company and tenant administrator provisioned.'); setCreating(false); navigate(`/super-admin/tenants/${tenant.id}`); } catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to create company.'); } })}>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['name', 'subdomain', 'ownerEmail', 'contactName', 'country', 'adminName', 'adminEmail'] as const).map((name) => <FormField key={name} label={name.replace(/([A-Z])/g, ' $1')} error={form.formState.errors[name]?.message}><TextInput {...form.register(name)} /></FormField>)}
        </div>
        <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">The company starts with Settings access, 10 users and 2 branches. Configure its exact modules and limits after creation.</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setCreating(false)}>Cancel</Button><Button type="submit" isLoading={create.isPending}>Create Company</Button></div>
      </form>
    </Modal>
  </PageContainer>;
}
