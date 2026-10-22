import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, Boxes, CheckCircle2, ClipboardCopy, Download, Edit, Eye, FileSpreadsheet, FileUp, Package, Plus, Power, PowerOff, Trash2, TriangleAlert } from 'lucide-react';
import { useBranch } from '@/core/branch/branch-context';
import { useTenantCurrency } from '@/features/settings/finance/currency';
import { TENANT_PERMISSIONS as PERMISSIONS } from '@/core/permissions';
import { usePermission } from '@/core/permissions/permission-context';
import { Card } from '@/shared/components/common/Card';
import { Button } from '@/shared/components/common/Button';
import { Dropdown } from '@/shared/components/common/Dropdown';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { StatCard } from '@/shared/components/cards/StatCard';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { controlBase } from '@/shared/components/forms/controlStyles';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { DataTable } from '@/shared/components/tables/DataTable';
import { FilterPanel } from '@/shared/components/tables/FilterPanel';
import { TableToolbar } from '@/shared/components/tables/TableToolbar';
import type { Column } from '@/shared/components/tables/TableHeader';
import type { DropdownItem } from '@/shared/components/common/Dropdown';
import { formatDate } from '@/shared/utils/formatters';
import { appToast } from '@/shared/utils/toast';
import { cn } from '@/shared/utils/cn';
import { downloadCsv, downloadExcel, type ExportColumn } from '@/shared/utils/fileExport';
import { useProductExport, useProductFilterOptions, useProductMutations, useProducts } from '../hooks/useProducts';
import type { ProductExportRow } from '../services/productService';
import type { InventoryTrackingFilter } from '../services/productService';
import type { ProductListItem, ProductStatus, ProductType } from '../types/product';

const typeLabels: Record<ProductType, string> = {
  goods: 'Goods',
  service: 'Service',
  composite: 'Composite',
};

export function ProductListPage() {
  const navigate = useNavigate();
  const { currentBranch } = useBranch();
  const currency = useTenantCurrency();
  const canCreate = usePermission(PERMISSIONS.PRODUCTS.PRODUCTS_CREATE);
  const canImport = usePermission(PERMISSIONS.PRODUCTS.PRODUCTS_IMPORT);
  const canEdit = usePermission(PERMISSIONS.PRODUCTS.PRODUCTS_EDIT);
  const canDelete = usePermission(PERMISSIONS.PRODUCTS.PRODUCTS_DELETE);
  const canActivate = usePermission(PERMISSIONS.PRODUCTS.PRODUCTS_ACTIVATE);
  const canExport = usePermission(PERMISSIONS.PRODUCTS.PRODUCTS_EXPORT);
  const canManagePrices = usePermission(PERMISSIONS.PRODUCTS.PRODUCTS_MANAGE_PRICES);
  const mutations = useProductMutations();
  const productExport = useProductExport();
  const [pendingAction, setPendingAction] = useState<{
    type: 'activate' | 'deactivate' | 'archive' | 'delete';
    product: ProductListItem;
  } | null>(null);
  const filterOptionsQuery = useProductFilterOptions();
  const {
    products,
    total,
    summary,
    isLoading,
    error,
    refetch,
    search,
    setSearch,
    status,
    setStatus,
    categoryId,
    setCategoryId,
    type,
    setType,
    inventoryTracking,
    setInventoryTracking,
    sortField,
    sortOrder,
    toggleSort,
    page,
    setPage,
    pageSize,
    setPageSize,
    resetFilters,
    params,
  } = useProducts();
  const activeFilterCount =
    (status !== 'all' ? 1 : 0) +
    (categoryId !== 'all' ? 1 : 0) +
    (type !== 'all' ? 1 : 0) +
    (inventoryTracking !== 'all' ? 1 : 0);
  const hasActiveFilters = Boolean(search || activeFilterCount);

  const copySku = async (product: ProductListItem) => {
    try {
      await navigator.clipboard.writeText(product.sku);
      appToast.success(`Copied SKU ${product.sku}.`);
    } catch {
      appToast.error('Unable to copy the SKU.');
    }
  };

  const exportColumns: ExportColumn<ProductExportRow>[] = [
    { header: 'Product Name', value: (row) => row.name },
    { header: 'SKU', value: (row) => row.sku },
    { header: 'Barcode', value: (row) => row.barcode },
    { header: 'Category', value: (row) => row.category },
    { header: 'Brand', value: (row) => row.brand },
    { header: 'Type', value: (row) => row.type },
    { header: 'UOM', value: (row) => row.uom },
    ...(canManagePrices ? [{ header: 'Cost Price', value: (row: ProductExportRow) => row.costPrice }] : []),
    { header: 'Selling Price', value: (row) => row.sellingPrice },
    { header: 'Status', value: (row) => row.status },
    { header: 'Track Inventory', value: (row) => row.trackInventory },
  ];

  const exportProducts = async (format: 'csv' | 'excel') => {
    try {
      const rows = await productExport.exportProducts(params);
      const date = new Date().toISOString().slice(0, 10);
      if (format === 'csv') downloadCsv(`products-${date}.csv`, exportColumns, rows);
      else downloadExcel(`products-${date}.xls`, 'Products', exportColumns, rows);
      appToast.success(`${rows.length} filtered product${rows.length === 1 ? '' : 's'} exported.`);
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : 'Unable to export products.');
    }
  };

  const confirmProductAction = async () => {
    if (!pendingAction) return;
    const { product, type: action } = pendingAction;
    try {
      if (action === 'activate') await mutations.setProductStatus(product.id, 'active');
      if (action === 'deactivate') await mutations.setProductStatus(product.id, 'inactive');
      if (action === 'archive') await mutations.archiveProduct(product.id);
      if (action === 'delete') await mutations.deleteProduct(product.id);
      appToast.success(action === 'delete' ? 'Product permanently deleted.' : `Product ${action}d successfully.`);
      setPendingAction(null);
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : 'Unable to update the product.');
    }
  };

  const columns: Column<ProductListItem>[] = [
    {
      key: 'name',
      header: 'Product',
      sortable: true,
      render: (product) => (
        <div className="flex min-w-52 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {product.primaryImage ? (
              <img src={product.primaryImage.previewUrl ?? product.primaryImage.url} alt="" className="h-full w-full object-cover" />
            ) : (
              <Package size={18} className="text-slate-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-blue-600">{product.name}</div>
            {product.brand && <div className="mt-0.5 text-xs text-slate-500">{product.brand}</div>}
          </div>
        </div>
      ),
    },
    {
      key: 'sku',
      header: 'SKU / Barcode',
      sortable: true,
      render: (product) => (
        <div className="min-w-36">
          <div className="font-mono font-semibold text-slate-700">{product.sku}</div>
          {product.barcode && <div className="mt-0.5 text-xs text-slate-500">{product.barcode}</div>}
        </div>
      ),
    },
    {
      key: 'categoryName',
      header: 'Category',
      render: (product) => <span className="text-slate-700">{product.categoryName}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (product) => <span className="text-sm text-slate-600">{typeLabels[product.type]}</span>,
    },
    {
      key: 'uomCode',
      header: 'UOM',
      width: '90px',
      render: (product) => <span title={product.uomName}>{product.uomCode}</span>,
    },
    {
      key: 'sellingPrice',
      header: 'Selling Price',
      sortable: true,
      align: 'right',
      render: (product) => (
        <span className="font-semibold text-slate-900">
          {currency.formatMoney(product.sellingPrice)}
        </span>
      ),
    },
    {
      key: 'stock',
      header: currentBranch ? `Stock (${currentBranch.code})` : 'Stock',
      render: (product) => product.trackInventory ? (
        <div>
          <div className="font-semibold text-slate-900">{product.stock.quantityAvailable} available</div>
          <StatusBadge status={product.stock.status} className="mt-1" />
        </div>
      ) : (
        <StatusBadge status="not_tracked" label="Not tracked" />
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      render: (product) => <span className="whitespace-nowrap text-slate-600">{formatDate(product.createdAt)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (product) => <StatusBadge status={product.status} />,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Products & Services"
        description="Manage tenant product master data, pricing, identifiers and branch stock visibility."
        actions={(canCreate || canImport || canExport) ? <>{canExport && <Dropdown align="right" trigger={<Button variant="secondary" leftIcon={<Download size={16} />} isLoading={productExport.isExporting}>Export</Button>} items={[{ key: 'csv', label: 'Export CSV', icon: <Download size={14} />, onClick: () => void exportProducts('csv') }, { key: 'excel', label: 'Export Excel', icon: <FileSpreadsheet size={14} />, onClick: () => void exportProducts('excel') }]} />}{canImport && <Button variant="secondary" leftIcon={<FileUp size={16} />} onClick={() => navigate('/products/import')}>Import Products</Button>}{canCreate && <Button leftIcon={<Plus size={16} />} onClick={() => navigate('/products/new')}>Add Product</Button>}</> : undefined}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Products" value={summary.totalProducts} icon={<Package size={20} />} description="Tenant catalog records" />
        <StatCard title="Active" value={summary.activeProducts} icon={<CheckCircle2 size={20} className="text-emerald-600" />} description="Available to transactions" />
        <StatCard title="Inventory Tracked" value={summary.inventoryTrackedProducts} icon={<Boxes size={20} />} description="Stock-controlled items" />
        <StatCard title="Low / Out of Stock" value={summary.lowStockProducts} icon={<TriangleAlert size={20} className="text-amber-600" />} description={currentBranch?.name ?? 'Selected branch'} />
      </div>

      {error ? (
        <Card className="p-0">
          <ErrorState message={error} onRetry={() => void refetch()} />
        </Card>
      ) : (
        <DataTable<ProductListItem>
          columns={columns}
          data={products}
          keyField="id"
          isLoading={isLoading}
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={toggleSort}
          onRowClick={(product) => navigate(`/products/${product.id}`)}
          emptyTitle={hasActiveFilters ? 'No products match your search or filters' : 'No products found'}
          emptyMessage={hasActiveFilters ? 'Try adjusting the product filters.' : 'No product master records are available for this tenant.'}
          emptyAction={hasActiveFilters ? <Button variant="secondary" size="sm" onClick={resetFilters}>Reset Filters</Button> : undefined}
          rowActions={(product): DropdownItem[] => {
            const actions: DropdownItem[] = [{
              key: 'view',
              label: 'View Details',
              icon: <Eye size={14} />,
              onClick: () => navigate(`/products/${product.id}`),
            }];
            if (canEdit) actions.push({
              key: 'edit',
              label: 'Edit Product',
              icon: <Edit size={14} />,
              onClick: () => navigate(`/products/${product.id}/edit`),
            });
            if (canActivate && product.status !== 'archived') actions.push({
              key: product.status === 'active' ? 'deactivate' : 'activate',
              label: product.status === 'active' ? 'Deactivate Product' : 'Activate Product',
              icon: product.status === 'active' ? <PowerOff size={14} /> : <Power size={14} />,
              onClick: () => setPendingAction({ type: product.status === 'active' ? 'deactivate' : 'activate', product }),
            });
            if (canDelete && product.status !== 'archived') actions.push({
              key: 'archive',
              label: 'Archive Product',
              icon: <Archive size={14} />,
              onClick: () => setPendingAction({ type: 'archive', product }),
            });
            if (canDelete) actions.push({
              key: 'delete',
              label: 'Delete Permanently',
              icon: <Trash2 size={14} />,
              danger: true,
              onClick: () => setPendingAction({ type: 'delete', product }),
            });
            actions.push({
              key: 'copy-sku',
              label: 'Copy SKU',
              icon: <ClipboardCopy size={14} />,
              onClick: () => void copySku(product),
            });
            return actions;
          }}
          pagination={{ page, pageSize, total, onPageChange: setPage, onPageSizeChange: setPageSize }}
          toolbar={
            <TableToolbar
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by name, SKU, barcode, code or brand..."
              filters={
                <FilterPanel activeFilterCount={activeFilterCount} onReset={resetFilters}>
                  <select
                    className={cn(controlBase, 'h-8 w-full py-0 text-xs sm:w-auto')}
                    value={status}
                    onChange={(event) => setStatus(event.target.value as ProductStatus | 'all')}
                    aria-label="Filter products by status"
                  >
                    <option value="all">All Statuses</option>
                    {filterOptionsQuery.data?.statuses.map((option) => (
                      <option key={option} value={option}>{option.replace('_', ' ')}</option>
                    ))}
                  </select>
                  <select
                    className={cn(controlBase, 'h-8 w-full py-0 text-xs sm:w-auto')}
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                    aria-label="Filter products by category"
                  >
                    <option value="all">All Categories</option>
                    {filterOptionsQuery.data?.categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                  <select
                    className={cn(controlBase, 'h-8 w-full py-0 text-xs sm:w-auto')}
                    value={type}
                    onChange={(event) => setType(event.target.value as ProductType | 'all')}
                    aria-label="Filter products by type"
                  >
                    <option value="all">All Types</option>
                    {filterOptionsQuery.data?.types.map((option) => (
                      <option key={option} value={option}>{typeLabels[option]}</option>
                    ))}
                  </select>
                  <select
                    className={cn(controlBase, 'h-8 w-full py-0 text-xs sm:w-auto')}
                    value={inventoryTracking}
                    onChange={(event) => setInventoryTracking(event.target.value as InventoryTrackingFilter)}
                    aria-label="Filter by inventory tracking"
                  >
                    <option value="all">All Tracking</option>
                    <option value="tracked">Inventory Tracked</option>
                    <option value="not_tracked">Not Tracked</option>
                  </select>
                </FilterPanel>
              }
            />
          }
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(pendingAction)}
        title={pendingAction ? `${pendingAction.type[0].toUpperCase()}${pendingAction.type.slice(1)} Product` : 'Update Product'}
        message={pendingAction?.type === 'delete'
          ? `Permanently delete ${pendingAction.product.name}? Products with variants, relationships, stock or other dependent records cannot be deleted and should be archived instead.`
          : pendingAction?.type === 'archive'
            ? `Archive ${pendingAction.product.name}? It will remain available to authorized users but will be excluded from normal transaction selectors.`
            : `${pendingAction?.type === 'activate' ? 'Activate' : 'Deactivate'} ${pendingAction?.product.name ?? 'this product'}?`}
        confirmLabel={pendingAction?.type === 'delete' ? 'Delete Permanently' : pendingAction?.type === 'archive' ? 'Archive Product' : pendingAction?.type === 'activate' ? 'Activate Product' : 'Deactivate Product'}
        variant={pendingAction?.type === 'delete' ? 'danger' : 'warning'}
        isLoading={mutations.isChangingStatus || mutations.isArchiving || mutations.isDeleting}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void confirmProductAction()}
      />

    </PageContainer>
  );
}
