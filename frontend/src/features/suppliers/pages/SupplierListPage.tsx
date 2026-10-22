import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  Trash2,
  MapPin,
  Eye,
  Edit,
  Power,
  PowerOff,
  Download,
  FileSpreadsheet,
} from 'lucide-react';

import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { StatCard } from '@/shared/components/cards/StatCard';
import { DataTable } from '@/shared/components/tables/DataTable';
import { TableToolbar } from '@/shared/components/tables/TableToolbar';
import { FilterPanel } from '@/shared/components/tables/FilterPanel';
import { Button } from '@/shared/components/common/Button';
import { Dropdown } from '@/shared/components/common/Dropdown';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Card } from '@/shared/components/common/Card';
import { controlBase } from '@/shared/components/forms/controlStyles';
import { cn } from '@/shared/utils/cn';
import { getErrorMessage } from '@/shared/utils/errors';
import { appToast } from '@/shared/utils/toast';
import { PERMISSIONS } from '@/core/permissions';
import { usePermissions } from '@/core/permissions/permission-context';

import type { Column } from '@/shared/components/tables/TableHeader';
import type { DropdownItem } from '@/shared/components/common/Dropdown';
import type { Supplier, SupplierStatus } from '@/features/suppliers/types/supplier';
import { useSuppliers } from '../hooks/useSuppliers';
import { SupplierStatusBadge } from '../components/SupplierStatusBadge';
import { useSupplierExport } from '../hooks/useSupplierExport';

export function SupplierListPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission(PERMISSIONS.SUPPLIERS.SUPPLIERS_CREATE);
  const canEdit = hasPermission(PERMISSIONS.SUPPLIERS.SUPPLIERS_EDIT);
  const canDelete = hasPermission(PERMISSIONS.SUPPLIERS.SUPPLIERS_DELETE);
  const canExport = hasPermission(PERMISSIONS.SUPPLIERS.SUPPLIERS_EXPORT);
  const { exportSuppliers, isExporting } = useSupplierExport();

  const {
    suppliers,
    total,
    isLoading,
    error,
    refetch,
    search,
    setSearch,
    status,
    setStatus,
    country,
    setCountry,
    sortField,
    sortOrder,
    toggleSort,
    resetFilters,
    page,
    setPage,
    pageSize,
    exportParams,
    setPageSize,
    deleteSupplier,
    isDeleting,
    updateSupplier,
    isUpdating,
  } = useSuppliers();

  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);
  const [deactivatingSupplier, setDeactivatingSupplier] = useState<Supplier | null>(null);

  // Stats calculation
  const activeCount = suppliers.filter((s) => s.status === 'active').length;
  const pendingCount = suppliers.filter((s) => s.status === 'pending').length;
  const inactiveCount = suppliers.filter((s) => s.status === 'inactive').length;

  const columns: Column<Supplier>[] = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      width: '120px',
      render: (row) => (
        <button
          type="button"
          onClick={() => navigate(`/suppliers/${row.id}`)}
          className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-800 hover:bg-blue-50 hover:text-blue-700 transition-colors"
        >
          {row.code}
        </button>
      ),
    },
    {
      key: 'name',
      header: 'Supplier Name',
      sortable: true,
      render: (row) => (
        <div>
          <button
            type="button"
            onClick={() => navigate(`/suppliers/${row.id}`)}
            className="text-left font-semibold text-slate-900 hover:text-blue-600 transition-colors"
          >
            {row.name}
          </button>
          <div className="text-xs text-slate-500">{row.email}</div>
        </div>
      ),
    },
    {
      key: 'contactPerson',
      header: 'Contact Person',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium text-slate-800">{row.contactPerson}</div>
          <div className="text-xs text-slate-500">{row.phone}</div>
        </div>
      ),
    },
    {
      key: 'city',
      header: 'Location',
      render: (row) => {
        const parts = [row.address.city, row.address.state, row.address.country].filter(Boolean);
        return parts.length > 0 ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <MapPin size={13} className="shrink-0 text-slate-400" />
            <span>{parts.join(', ')}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        );
      },
    },
    {
      key: 'currency',
      header: 'Terms & Currency',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-700">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-600">
            {row.currency}
          </span>
          <span className="text-slate-400">•</span>
          <span>
            {row.paymentTermsDays ? `${row.paymentTermsDays} Days` : 'Immediate'}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      width: '110px',
      render: (row) => <SupplierStatusBadge status={row.status} />,
    },
  ];

  const handleConfirmDelete = async () => {
    if (!deletingSupplier) return;
    try {
      await deleteSupplier(deletingSupplier.id);
      appToast.success(`Supplier "${deletingSupplier.name}" deleted successfully.`);
      setDeletingSupplier(null);
    } catch (err) {
      appToast.error(getErrorMessage(err, 'Unable to delete supplier. Please try again.'));
    }
  };

  const handleActivate = async (supplier: Supplier) => {
    try {
      await updateSupplier(supplier.id, { status: 'active' });
      appToast.success(`Supplier "${supplier.name}" is now active.`);
    } catch (err) {
      appToast.error(getErrorMessage(err, 'Unable to activate supplier. Please try again.'));
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivatingSupplier) return;
    try {
      await updateSupplier(deactivatingSupplier.id, { status: 'inactive' });
      appToast.success(`Supplier "${deactivatingSupplier.name}" has been deactivated.`);
      setDeactivatingSupplier(null);
    } catch (err) {
      appToast.error(getErrorMessage(err, 'Unable to deactivate supplier. Please try again.'));
    }
  };

  const hasActiveFilters = status !== 'all' || country !== 'all' || Boolean(search);
  const activeFiltersCount = (status !== 'all' ? 1 : 0) + (country !== 'all' ? 1 : 0);

  return (
    <PageContainer>
      <PageHeader
        title="Suppliers"
        description="Manage supplier directory, vendor profiles, contact details, and payment terms."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canExport && (
              <Dropdown
                align="right"
                trigger={
                  <Button variant="secondary" leftIcon={<Download size={16} />} isLoading={isExporting}>
                    Export
                  </Button>
                }
                items={[
                  { key: 'csv', label: 'Export CSV', icon: <Download size={14} />, onClick: () => void exportSuppliers(exportParams, 'csv') },
                  { key: 'excel', label: 'Export Excel', icon: <FileSpreadsheet size={14} />, onClick: () => void exportSuppliers(exportParams, 'excel') },
                ]}
              />
            )}
            {canCreate && (
              <Button
                variant="primary"
                leftIcon={<Plus size={16} />}
                onClick={() => navigate('/suppliers/new')}
              >
                Add Supplier
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Suppliers"
          value={total}
          icon={<Truck size={20} />}
          description="Registered vendors"
        />
        <StatCard
          title="Active Vendors"
          value={activeCount}
          icon={<CheckCircle2 size={20} className="text-emerald-600" />}
          change={{ value: 'In good standing', trend: 'up' }}
        />
        <StatCard
          title="Pending Review"
          value={pendingCount}
          icon={<Clock size={20} className="text-amber-600" />}
          description="Awaiting verification"
        />
        <StatCard
          title="Inactive"
          value={inactiveCount}
          icon={<XCircle size={20} className="text-slate-400" />}
          description="Dormant vendors"
        />
      </div>

      {/* Data Table with Search, Filters, Sorting, and Pagination */}
      {error ? (
        <Card className="p-0">
          <ErrorState message={error} onRetry={() => void refetch()} />
        </Card>
      ) : (
        <DataTable<Supplier>
          columns={columns}
          data={suppliers}
          keyField="id"
          isLoading={isLoading}
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={toggleSort}
          emptyTitle={hasActiveFilters ? 'No suppliers match your search or filters' : 'No suppliers found'}
          emptyMessage={
            hasActiveFilters
              ? 'Try adjusting your search query or filter settings.'
              : 'No suppliers have been added to the directory yet.'
          }
          emptyAction={
            hasActiveFilters ? (
              <Button variant="secondary" size="sm" onClick={resetFilters}>
                Reset Filters
              </Button>
            ) : canCreate ? (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => navigate('/suppliers/new')}
              >
                Add Supplier
              </Button>
            ) : undefined
          }
          rowActions={(supplier) => {
            const actions: DropdownItem[] = [
              {
                key: 'view',
                label: 'View Details',
                icon: <Eye size={14} />,
                onClick: () => navigate(`/suppliers/${supplier.id}`),
              },
            ];

            if (canEdit) {
              actions.push({
                key: 'edit',
                label: 'Edit Supplier',
                icon: <Edit size={14} />,
                onClick: () => navigate(`/suppliers/${supplier.id}/edit`),
              });

              if (supplier.status === 'active') {
                actions.push({
                  key: 'deactivate',
                  label: 'Deactivate Supplier',
                  icon: <PowerOff size={14} />,
                  onClick: () => setDeactivatingSupplier(supplier),
                });
              } else if (supplier.status === 'inactive') {
                actions.push({
                  key: 'activate',
                  label: 'Activate Supplier',
                  icon: <Power size={14} />,
                  onClick: () => void handleActivate(supplier),
                });
              }
            }

            if (canDelete) {
              actions.push({
                key: 'delete',
                label: 'Delete Supplier',
                icon: <Trash2 size={14} />,
                danger: true,
                onClick: () => setDeletingSupplier(supplier),
              });
            }

            return actions;
          }}
          pagination={{
            page,
            pageSize,
            total,
            onPageChange: setPage,
            onPageSizeChange: setPageSize,
          }}
          toolbar={
            <TableToolbar
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by name, code, contact, email, phone..."
              filters={
                <FilterPanel
                  activeFilterCount={activeFiltersCount}
                  onReset={resetFilters}
                >
                  <select
                    className={cn(controlBase, 'h-8 w-full py-0 text-xs sm:w-auto')}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as SupplierStatus | 'all')}
                    aria-label="Filter by Status"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <select
                    className={cn(controlBase, 'h-8 w-full py-0 text-xs sm:w-auto')}
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    aria-label="Filter by Country"
                  >
                    <option value="all">All Countries</option>
                    <option value="US">United States (US)</option>
                    <option value="DE">Germany (DE)</option>
                    <option value="JP">Japan (JP)</option>
                    <option value="CA">Canada (CA)</option>
                    <option value="GB">United Kingdom (GB)</option>
                    <option value="CN">China (CN)</option>
                  </select>
                </FilterPanel>
              }
            />
          }
        />
      )}

      {/* Delete Confirmation Dialog */}
      {canDelete && (
        <ConfirmDialog
          isOpen={Boolean(deletingSupplier)}
          title="Delete Supplier"
          message={`Are you sure you want to delete supplier "${deletingSupplier?.name}" (${deletingSupplier?.code})? This action cannot be undone.`}
          variant="danger"
          confirmLabel="Delete Supplier"
          isLoading={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingSupplier(null)}
        />
      )}

      {canEdit && (
        <ConfirmDialog
          isOpen={Boolean(deactivatingSupplier)}
          title="Deactivate Supplier"
          message={`Deactivate "${deactivatingSupplier?.name}" (${deactivatingSupplier?.code})? The supplier record will remain in the directory and can be activated again.`}
          variant="warning"
          confirmLabel="Deactivate Supplier"
          isLoading={isUpdating}
          onConfirm={handleConfirmDeactivate}
          onCancel={() => setDeactivatingSupplier(null)}
        />
      )}
    </PageContainer>
  );
}
