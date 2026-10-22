import { useState } from 'react';
import { Archive, ArrowLeft, Download, Edit, Eye, MoreHorizontal, Plus, Power, PowerOff, Tags, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { TENANT_PERMISSIONS as PERMISSIONS } from '@/core/permissions';
import { usePermission } from '@/core/permissions/permission-context';
import { useTenantCurrency } from '@/features/settings/finance/currency';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { Dropdown, type DropdownItem } from '@/shared/components/common/Dropdown';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { NotFoundState } from '@/shared/components/feedback/NotFoundState';
import { Select } from '@/shared/components/forms/Select';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { DataTable } from '@/shared/components/tables/DataTable';
import { FilterPanel } from '@/shared/components/tables/FilterPanel';
import { TableToolbar } from '@/shared/components/tables/TableToolbar';
import type { Column } from '@/shared/components/tables/TableHeader';
import { downloadCsv, type ExportColumn } from '@/shared/utils/fileExport';
import { formatDate } from '@/shared/utils/formatters';
import { appToast } from '@/shared/utils/toast';
import { PriceListForm } from '../components/PriceListForm';
import { ProductPageSkeleton } from '../components/ProductLoadingStates';
import { PriceRuleFormModal } from '../components/PriceRuleFormModal';
import { usePriceList, usePriceListMutations, usePriceLists, usePriceRules } from '../hooks/usePriceLists';
import type { PriceListFormValues } from '../schemas/priceListSchema';
import type { PriceListListItem, PriceListStatus, PriceListType, PriceRuleListItem } from '../types/priceList';

const typeLabels: Record<PriceListType, string> = { retail: 'Retail', wholesale: 'Wholesale', distributor: 'Distributor', custom: 'Custom' };

export function PriceListPage() {
  const navigate = useNavigate();
  const canCreate = usePermission(PERMISSIONS.PRODUCTS.PRICE_LISTS_CREATE);
  const canEdit = usePermission(PERMISSIONS.PRODUCTS.PRICE_LISTS_EDIT);
  const canDelete = usePermission(PERMISSIONS.PRODUCTS.PRICE_LISTS_DELETE);
  const canExport = usePermission(PERMISSIONS.PRODUCTS.PRICE_LISTS_EXPORT);
  const data = usePriceLists();
  const mutations = usePriceListMutations();
  const [pending, setPending] = useState<{ item: PriceListListItem; action: 'activate' | 'deactivate' | 'archive' | 'delete' } | null>(null);
  const activeFilters = (data.status !== 'all' ? 1 : 0) + (data.type !== 'all' ? 1 : 0);
  const hasFilters = Boolean(data.search || activeFilters);

  const columns: Column<PriceListListItem>[] = [
    { key: 'name', header: 'Price List', render: (item) => <div className="min-w-48"><p className="font-semibold text-blue-600">{item.name}</p><p className="font-mono text-xs text-slate-500">{item.code}</p></div> },
    { key: 'type', header: 'Type', render: (item) => typeLabels[item.type] },
    { key: 'currency', header: 'Currency' },
    { key: 'productCount', header: 'Products', align: 'right' },
    { key: 'ruleCount', header: 'Rules / Tiers', align: 'right' },
    { key: 'effectiveStartDate', header: 'Effective Period', render: (item) => <span className="whitespace-nowrap">{item.effectiveStartDate ? formatDate(item.effectiveStartDate) : 'Any time'} – {item.effectiveEndDate ? formatDate(item.effectiveEndDate) : 'No end'}</span> },
    { key: 'status', header: 'Status', render: (item) => <StatusBadge status={item.status} /> },
  ];

  const rowActions = (item: PriceListListItem): DropdownItem[] => [
    { key: 'view', label: 'View Rules', icon: <Eye size={14} />, onClick: () => navigate(`/products/price-lists/${item.id}`) },
    ...(canEdit ? [{ key: 'edit', label: 'Edit Price List', icon: <Edit size={14} />, onClick: () => navigate(`/products/price-lists/${item.id}/edit`) }] : []),
    ...(canEdit && item.status !== 'archived' ? [{ key: 'status', label: item.status === 'active' ? 'Deactivate' : 'Activate', icon: item.status === 'active' ? <PowerOff size={14} /> : <Power size={14} />, onClick: () => setPending({ item, action: item.status === 'active' ? 'deactivate' : 'activate' }) }] : []),
    ...(canDelete && item.status !== 'archived' ? [{ key: 'archive', label: 'Archive Price List', icon: <Archive size={14} />, onClick: () => setPending({ item, action: 'archive' }) }] : []),
    ...(canDelete ? [{ key: 'delete', label: 'Delete Permanently', icon: <Trash2 size={14} />, danger: true, onClick: () => setPending({ item, action: 'delete' }) }] : []),
  ];

  const confirm = async () => {
    if (!pending) return;
    try {
      if (pending.action === 'activate') await mutations.setStatus(pending.item.id, 'active');
      if (pending.action === 'deactivate') await mutations.setStatus(pending.item.id, 'inactive');
      if (pending.action === 'archive') await mutations.archive(pending.item.id);
      if (pending.action === 'delete') await mutations.remove(pending.item.id);
      appToast.success(pending.action === 'delete' ? 'Price list deleted.' : `Price list ${pending.action}d.`);
      setPending(null);
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : 'Unable to update the price list.');
    }
  };

  const exportRows = async () => {
    try {
      const rows = await mutations.exportRows({ search: data.params.search, status: data.status, type: data.type });
      const exportColumns: ExportColumn<PriceListListItem>[] = [
        { header: 'Name', value: (row) => row.name }, { header: 'Code', value: (row) => row.code },
        { header: 'Type', value: (row) => row.type }, { header: 'Currency', value: (row) => row.currency },
        { header: 'Status', value: (row) => row.status }, { header: 'Products', value: (row) => row.productCount },
        { header: 'Rules / Tiers', value: (row) => row.ruleCount }, { header: 'Effective Start', value: (row) => row.effectiveStartDate },
        { header: 'Effective End', value: (row) => row.effectiveEndDate },
      ];
      downloadCsv(`price-lists-${new Date().toISOString().slice(0, 10)}.csv`, exportColumns, rows);
      appToast.success(`${rows.length} price list${rows.length === 1 ? '' : 's'} exported.`);
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : 'Unable to export price lists.');
    }
  };

  return <PageContainer>
    <PageHeader title="Price Lists & Rules" description="Manage tenant retail, wholesale, distributor and custom pricing." actions={<>{canExport && <Button variant="secondary" leftIcon={<Download size={16} />} isLoading={mutations.isExporting} onClick={() => void exportRows()}>Export</Button>}{canCreate && <Button leftIcon={<Plus size={16} />} onClick={() => navigate('/products/price-lists/new')}>Add Price List</Button>}</>} />
    {data.error ? <Card className="p-0"><ErrorState message={data.error} onRetry={() => void data.refetch()} /></Card> : <DataTable columns={columns} data={data.priceLists} keyField="id" isLoading={data.isLoading} onRowClick={(item) => navigate(`/products/price-lists/${item.id}`)} rowActions={rowActions} emptyTitle={hasFilters ? 'No price lists match your filters' : 'No price lists found'} emptyMessage={hasFilters ? 'Try changing or resetting the search and filters.' : 'Create a price list to define tenant pricing rules.'} emptyAction={hasFilters ? <Button variant="secondary" size="sm" onClick={data.resetFilters}>Reset Filters</Button> : canCreate ? <Button size="sm" onClick={() => navigate('/products/price-lists/new')}>Add Price List</Button> : undefined} pagination={{ page: data.page, pageSize: data.pageSize, total: data.total, onPageChange: data.setPage, onPageSizeChange: data.setPageSize }} toolbar={<TableToolbar searchValue={data.search} onSearchChange={data.setSearch} searchPlaceholder="Search name, code or currency..." filters={<FilterPanel activeFilterCount={activeFilters} onReset={data.resetFilters}><Select className="w-40 py-1 text-xs" value={data.status} onChange={(event) => data.setStatus(event.target.value as PriceListStatus | 'all')} options={[{ value: 'all', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'archived', label: 'Archived' }]} /><Select className="w-40 py-1 text-xs" value={data.type} onChange={(event) => data.setType(event.target.value as PriceListType | 'all')} options={[{ value: 'all', label: 'All types' }, ...Object.entries(typeLabels).map(([value, label]) => ({ value, label }))]} /></FilterPanel>} />} />}
    <ConfirmDialog isOpen={Boolean(pending)} title={`${pending?.action === 'delete' ? 'Delete' : pending?.action === 'archive' ? 'Archive' : pending?.action === 'deactivate' ? 'Deactivate' : 'Activate'} Price List`} message={pending?.action === 'delete' ? `Permanently delete "${pending.item.name}"? Lists with pricing rules cannot be deleted.` : `${pending?.action === 'deactivate' ? 'Deactivate' : pending?.action === 'activate' ? 'Activate' : 'Archive'} "${pending?.item.name ?? 'this price list'}"?`} confirmLabel={pending?.action === 'delete' ? 'Delete Price List' : 'Confirm'} variant={pending?.action === 'delete' ? 'danger' : 'warning'} isLoading={mutations.isDeleting || mutations.isArchiving || mutations.isChangingStatus} onCancel={() => setPending(null)} onConfirm={() => void confirm()} />
  </PageContainer>;
}

export function PriceListFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const detail = usePriceList(id);
  const mutations = usePriceListMutations();
  const isEditing = Boolean(id);
  const submit = async (values: PriceListFormValues) => {
    try {
      const saved = id ? await mutations.update(id, values) : await mutations.create(values);
      appToast.success(`Price list ${id ? 'updated' : 'created'}.`);
      navigate(`/products/price-lists/${saved.id}`);
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : 'Unable to save the price list.');
    }
  };
  if (isEditing && detail.isLoading) return <PageContainer><ProductPageSkeleton /></PageContainer>;
  if (isEditing && detail.error) return <PageContainer><Card className="p-0"><ErrorState message="Failed to load the price list." onRetry={() => void detail.refetch()} /></Card></PageContainer>;
  if (isEditing && !detail.data) return <PageContainer><Card className="p-0"><NotFoundState title="Price List Not Found" message="This price list does not exist in the active tenant." actionText="Return to Price Lists" actionHref="/products/price-lists" /></Card></PageContainer>;
  return <PageContainer><div className="mb-4"><Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate(id ? `/products/price-lists/${id}` : '/products/price-lists')}>Back</Button></div><PageHeader title={id ? `Edit Price List: ${detail.data?.name}` : 'Add Price List'} description="Configure company-wide pricing metadata using the tenant base currency." /><PriceListForm priceList={detail.data} isSaving={mutations.isSaving} onCancel={() => navigate(id ? `/products/price-lists/${id}` : '/products/price-lists')} onSubmit={submit} /></PageContainer>;
}

export function PriceListDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currency = useTenantCurrency();
  const canEdit = usePermission(PERMISSIONS.PRODUCTS.PRICE_LISTS_EDIT);
  const canDelete = usePermission(PERMISSIONS.PRODUCTS.PRICE_LISTS_DELETE);
  const detail = usePriceList(id);
  const rules = usePriceRules(id);
  const mutations = usePriceListMutations();
  const [editingRule, setEditingRule] = useState<PriceRuleListItem | null | undefined>();
  const [removingRule, setRemovingRule] = useState<PriceRuleListItem | null>(null);
  const [pendingAction, setPendingAction] = useState<'activate' | 'deactivate' | 'archive' | 'delete' | null>(null);
  if (detail.isLoading) return <PageContainer><ProductPageSkeleton /></PageContainer>;
  if (detail.error || !detail.data) return <PageContainer><div className="mb-4"><Button variant="ghost" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/products/price-lists')}>Back to Price Lists</Button></div><Card className="p-0">{detail.error ? <ErrorState message="Failed to load the price list." onRetry={() => void detail.refetch()} /> : <NotFoundState title="Price List Not Found" message="This price list does not exist in the active tenant." actionText="Return to Price Lists" actionHref="/products/price-lists" />}</Card></PageContainer>;
  const list = detail.data;
  const columns: Column<PriceRuleListItem>[] = [
    { key: 'productName', header: 'Product / Variant', render: (rule) => <div className="min-w-56"><p className="font-semibold text-slate-900">{rule.productName}{rule.variantLabel ? ` – ${rule.variantLabel}` : ''}</p><p className="font-mono text-xs text-slate-500">{rule.variantSku ?? rule.productSku}</p></div> },
    { key: 'pricingType', header: 'Method', render: (rule) => rule.pricingType === 'fixed' ? 'Fixed price' : 'Quantity tiers' },
    { key: 'fixedPrice', header: 'Pricing', render: (rule) => rule.pricingType === 'fixed' ? <span className="font-semibold">{currency.formatMoney(rule.fixedPrice ?? rule.defaultSellingPrice)}</span> : <div className="space-y-1">{rule.tiers.map((tier) => <p key={tier.id} className="whitespace-nowrap text-xs"><span className="font-medium">{tier.minQuantity}–{tier.maxQuantity ?? '∞'}:</span> {currency.formatMoney(tier.price)}</p>)}</div> },
    { key: 'defaultSellingPrice', header: 'Default / Fallback', align: 'right', render: (rule) => currency.formatMoney(rule.defaultSellingPrice) },
    { key: 'productStatus', header: 'Product Status', render: (rule) => <StatusBadge status={rule.productStatus} /> },
  ];
  const confirmLifecycle = async () => {
    if (!pendingAction) return;
    try {
      if (pendingAction === 'activate') await mutations.setStatus(id, 'active');
      if (pendingAction === 'deactivate') await mutations.setStatus(id, 'inactive');
      if (pendingAction === 'archive') await mutations.archive(id);
      if (pendingAction === 'delete') { await mutations.remove(id); appToast.success('Price list deleted.'); navigate('/products/price-lists'); return; }
      appToast.success(`Price list ${pendingAction}d.`); setPendingAction(null);
    } catch (error) { appToast.error(error instanceof Error ? error.message : 'Unable to update the price list.'); }
  };
  return <PageContainer>
    <div className="mb-4"><Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/products/price-lists')}>Back to Price Lists</Button></div>
    <PageHeader title={list.name} description={`${list.code} · ${typeLabels[list.type]} price list`} actions={<><StatusBadge status={list.status} />{canEdit && <Button leftIcon={<Edit size={16} />} onClick={() => navigate(`/products/price-lists/${id}/edit`)}>Edit Price List</Button>}{(canEdit || canDelete) && <Dropdown align="right" trigger={<Button variant="secondary" leftIcon={<MoreHorizontal size={16} />}>More Actions</Button>} items={[...(canEdit && list.status !== 'archived' ? [{ key: 'status', label: list.status === 'active' ? 'Deactivate' : 'Activate', icon: list.status === 'active' ? <PowerOff size={14} /> : <Power size={14} />, onClick: () => setPendingAction(list.status === 'active' ? 'deactivate' : 'activate') }] : []), ...(canDelete && list.status !== 'archived' ? [{ key: 'archive', label: 'Archive', icon: <Archive size={14} />, onClick: () => setPendingAction('archive') }] : []), ...(canDelete ? [{ key: 'delete', label: 'Delete Permanently', icon: <Trash2 size={14} />, danger: true, onClick: () => setPendingAction('delete') }] : [])]} />}</>} />
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Card><p className="text-xs font-semibold uppercase text-slate-500">Currency</p><p className="mt-2 text-xl font-bold">{list.currency}</p></Card><Card><p className="text-xs font-semibold uppercase text-slate-500">Products</p><p className="mt-2 text-xl font-bold">{list.productCount}</p></Card><Card><p className="text-xs font-semibold uppercase text-slate-500">Rules / Tiers</p><p className="mt-2 text-xl font-bold">{list.ruleCount}</p></Card><Card><p className="text-xs font-semibold uppercase text-slate-500">Effective Period</p><p className="mt-2 text-sm font-semibold">{list.effectiveStartDate ? formatDate(list.effectiveStartDate) : 'Any time'} – {list.effectiveEndDate ? formatDate(list.effectiveEndDate) : 'No end date'}</p></Card></div>
    {list.description && <Card className="mb-6"><h2 className="font-semibold text-slate-900">Description</h2><p className="mt-2 text-sm text-slate-600">{list.description}</p></Card>}
    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-semibold text-slate-900">Product Pricing Rules</h2><p className="text-sm text-slate-500">If no rule or quantity tier matches, the product or variant default selling price is used.</p></div>{canEdit && list.status !== 'archived' && <Button leftIcon={<Plus size={16} />} onClick={() => setEditingRule(null)}>Add Pricing Rule</Button>}</div>
    {rules.error ? <Card className="p-0"><ErrorState message={rules.error} onRetry={() => void rules.refetch()} /></Card> : <DataTable columns={columns} data={rules.rules} keyField="id" isLoading={rules.isLoading} rowActions={canEdit && list.status !== 'archived' ? (rule) => [{ key: 'edit', label: 'Edit Rule', icon: <Edit size={14} />, onClick: () => setEditingRule(rule) }, { key: 'delete', label: 'Remove Rule', icon: <Trash2 size={14} />, danger: true, onClick: () => setRemovingRule(rule) }] : undefined} emptyTitle="No pricing rules" emptyMessage="Add a product or variant rule. Default selling prices remain the fallback." emptyAction={canEdit && list.status !== 'archived' ? <Button size="sm" leftIcon={<Tags size={14} />} onClick={() => setEditingRule(null)}>Add Pricing Rule</Button> : undefined} />}
    {editingRule !== undefined && <PriceRuleFormModal priceListId={id} rule={editingRule} onClose={() => setEditingRule(undefined)} />}
    <ConfirmDialog isOpen={Boolean(removingRule)} title="Remove Pricing Rule" message={`Remove pricing for "${removingRule?.productName ?? 'this product'}"? Its default selling price will be used instead.`} confirmLabel="Remove Rule" variant="danger" isLoading={rules.isDeleting} onCancel={() => setRemovingRule(null)} onConfirm={() => { if (!removingRule) return; void rules.remove(removingRule.id).then(() => { appToast.success('Pricing rule removed.'); setRemovingRule(null); }).catch((error: unknown) => appToast.error(error instanceof Error ? error.message : 'Unable to remove pricing rule.')); }} />
    <ConfirmDialog isOpen={Boolean(pendingAction)} title={`${pendingAction === 'delete' ? 'Delete' : pendingAction === 'archive' ? 'Archive' : pendingAction === 'deactivate' ? 'Deactivate' : 'Activate'} Price List`} message={pendingAction === 'delete' ? `Permanently delete "${list.name}"? Lists with rules cannot be deleted.` : `${pendingAction === 'deactivate' ? 'Deactivate' : pendingAction === 'activate' ? 'Activate' : 'Archive'} "${list.name}"?`} confirmLabel="Confirm" variant={pendingAction === 'delete' ? 'danger' : 'warning'} isLoading={mutations.isDeleting || mutations.isArchiving || mutations.isChangingStatus} onCancel={() => setPendingAction(null)} onConfirm={() => void confirmLifecycle()} />
  </PageContainer>;
}
