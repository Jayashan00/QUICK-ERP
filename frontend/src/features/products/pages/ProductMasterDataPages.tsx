import { TENANT_PERMISSIONS as PERMISSIONS } from '@/core/permissions';
import { usePermission } from '@/core/permissions/permission-context';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import type { Column } from '@/shared/components/tables/TableHeader';
import { formatDate } from '@/shared/utils/formatters';
import { BrandFormModal, CategoryFormModal, UomFormModal } from '../components/MasterDataForms';
import { MasterDataPage } from '../components/MasterDataPage';
import { useBrands, useCategories, useCategoryOptions, useUoms } from '../hooks/useProductMasterData';
import type { Brand, Category, UOM } from '../types/product';

function DetailGrid({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return <dl className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">{items.map((item) => <div key={item.label}><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</dt><dd className="mt-1 text-sm text-slate-900">{item.value}</dd></div>)}</dl>;
}

export function ProductCategoryPage() {
  const data = useCategories();
  const options = useCategoryOptions(true);
  const canCreate = usePermission(PERMISSIONS.PRODUCTS.CATEGORIES_CREATE);
  const canEdit = usePermission(PERMISSIONS.PRODUCTS.CATEGORIES_EDIT);
  const canDelete = usePermission(PERMISSIONS.PRODUCTS.CATEGORIES_DELETE);
  const parentName = (id?: string) => options.data?.find((item) => item.id === id)?.name ?? 'Top level';
  const columns: Column<Category>[] = [
    { key: 'name', header: 'Category', render: (row) => <div><p className="font-semibold text-slate-900">{row.name}</p><p className="font-mono text-xs text-slate-500">{row.code}</p></div> },
    { key: 'parentId', header: 'Parent', render: (row) => parentName(row.parentId) },
    { key: 'sortOrder', header: 'Display Order', align: 'right' },
    { key: 'isActive', header: 'Status', render: (row) => <StatusBadge status={row.isActive ? 'active' : 'inactive'} /> },
  ];
  return <MasterDataPage title="Product Categories" description="Manage the tenant category hierarchy used by product master data." singular="Category" columns={columns} data={{ ...data, records: data.categories }} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} renderForm={(item, close) => <CategoryFormModal item={item} onClose={close} isSaving={data.isSaving} onSave={(values) => item ? data.update(item.id, values) : data.create(values)} />} renderDetails={(item) => <DetailGrid items={[{ label: 'Parent category', value: parentName(item.parentId) }, { label: 'Display order', value: item.sortOrder }, { label: 'Description', value: item.description || 'No description' }, { label: 'Created', value: formatDate(item.createdAt) }]} />} />;
}

export function ProductBrandPage() {
  const data = useBrands();
  const canCreate = usePermission(PERMISSIONS.PRODUCTS.BRANDS_CREATE);
  const canEdit = usePermission(PERMISSIONS.PRODUCTS.BRANDS_EDIT);
  const canDelete = usePermission(PERMISSIONS.PRODUCTS.BRANDS_DELETE);
  const columns: Column<Brand>[] = [
    { key: 'name', header: 'Brand', render: (row) => <div><p className="font-semibold text-slate-900">{row.name}</p><p className="font-mono text-xs text-slate-500">{row.code}</p></div> },
    { key: 'websiteUrl', header: 'Website', render: (row) => row.websiteUrl ? <a className="text-blue-600 hover:underline" href={row.websiteUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Visit website</a> : '—' },
    { key: 'isActive', header: 'Status', render: (row) => <StatusBadge status={row.isActive ? 'active' : 'inactive'} /> },
  ];
  return <MasterDataPage title="Product Brands" description="Manage optional tenant brands used to classify products." singular="Brand" columns={columns} data={{ ...data, records: data.brands }} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} renderForm={(item, close) => <BrandFormModal item={item} onClose={close} isSaving={data.isSaving} onSave={(values) => item ? data.update(item.id, values) : data.create(values)} />} renderDetails={(item) => <DetailGrid items={[{ label: 'Description', value: item.description || 'No description' }, { label: 'Website', value: item.websiteUrl ? <a className="text-blue-600 hover:underline" href={item.websiteUrl} target="_blank" rel="noreferrer">{item.websiteUrl}</a> : 'Not provided' }, { label: 'Logo URL', value: item.logoUrl || 'Not provided' }, { label: 'Created', value: formatDate(item.createdAt) }]} />} />;
}

export function ProductUomPage() {
  const data = useUoms();
  const canCreate = usePermission(PERMISSIONS.PRODUCTS.UOMS_CREATE);
  const canEdit = usePermission(PERMISSIONS.PRODUCTS.UOMS_EDIT);
  const canDelete = usePermission(PERMISSIONS.PRODUCTS.UOMS_DELETE);
  const columns: Column<UOM>[] = [
    { key: 'name', header: 'Unit', render: (row) => <div><p className="font-semibold text-slate-900">{row.name}{row.isDefault && <span className="ml-2 text-xs text-blue-600">Default</span>}</p><p className="font-mono text-xs text-slate-500">{row.code} · {row.symbol}</p></div> },
    { key: 'type', header: 'Type', render: (row) => <span className="capitalize">{row.type}</span> },
    { key: 'decimalPlaces', header: 'Precision', align: 'right', render: (row) => `${row.decimalPlaces} decimals` },
    { key: 'isActive', header: 'Status', render: (row) => <StatusBadge status={row.isActive ? 'active' : 'inactive'} /> },
  ];
  return <MasterDataPage title="Units of Measure" description="Manage tenant units used by products, purchasing and future conversions." singular="Unit" columns={columns} data={{ ...data, records: data.uoms }} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} renderForm={(item, close) => <UomFormModal item={item} onClose={close} isSaving={data.isSaving} onSave={(values) => item ? data.update(item.id, values) : data.create(values)} />} renderDetails={(item) => <DetailGrid items={[{ label: 'Symbol', value: item.symbol }, { label: 'Unit type', value: <span className="capitalize">{item.type}</span> }, { label: 'Decimal precision', value: item.decimalPlaces }, { label: 'Default / base', value: item.isDefault ? 'Yes' : 'No' }, { label: 'Description', value: item.description || 'No description' }, { label: 'Created', value: formatDate(item.createdAt) }]} />} />;
}
