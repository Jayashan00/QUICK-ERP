import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { TableToolbar } from '@/shared/components/tables/TableToolbar';
import { FilterPanel } from '@/shared/components/tables/FilterPanel';
import { Button } from '@/shared/components/common/Button';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Select } from '@/shared/components/forms/Select';
import { appToast } from '@/shared/utils/toast';
import { usePermissions } from '@/core/permissions/permission-context';
import { PERMISSIONS } from '@/core/permissions/permissionConstants';
import type { Department } from '@/features/settings/organization/types/department';
import { useDepartments } from '@/features/settings/organization/hooks/useDepartments';
import { useBranchOptions } from '@/features/settings/branches/hooks/useBranchOptions';
import { DepartmentTable } from '@/features/settings/organization/components/DepartmentTable';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export function DepartmentListPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { branches } = useBranchOptions({ includeInactive: true });
  const branchFilterOptions = [
    { value: 'all', label: 'All Branches' },
    ...branches.map((branch) => ({
      value: branch.id,
      label: branch.isActive ? branch.name : `${branch.name} (Inactive)`,
    })),
  ];

  const canCreate = hasPermission(PERMISSIONS.SETTINGS.DEPARTMENTS_CREATE);
  const canEdit = hasPermission(PERMISSIONS.SETTINGS.DEPARTMENTS_EDIT);
  const canDelete = hasPermission(PERMISSIONS.SETTINGS.DEPARTMENTS_DELETE);

  const {
    departments,
    total,
    isLoading,
    error,
    refetch,
    search,
    setSearch,
    status,
    setStatus,
    branchId,
    setBranchId,
    page,
    setPage,
    pageSize,
    setPageSize,
    deleteDepartment,
    isDeleting,
  } = useDepartments();

  const [deletingDept, setDeletingDept] = useState<Department | null>(null);

  const handleDeleteConfirm = async () => {
    if (!deletingDept) return;
    try {
      await deleteDepartment(deletingDept.id);
      appToast.success(`Department "${deletingDept.name}" has been deleted.`);
      setDeletingDept(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete department.';
      appToast.error(msg);
    }
  };

  const activeFiltersCount = (status !== 'all' ? 1 : 0) + (branchId !== 'all' ? 1 : 0);

  const handleResetFilters = () => {
    setStatus('all');
    setBranchId('all');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Manage the organization's departments."
        actions={
          canCreate ? (
            <Button
              variant="primary"
              leftIcon={<Plus size={16} />}
              onClick={() => navigate('/settings/departments/new')}
            >
              Add Department
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <ErrorState
          title="Error Loading Departments"
          message={error}
          onRetry={() => void refetch()}
        />
      ) : (
        <DepartmentTable
          departments={departments}
          isLoading={isLoading}
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          canEdit={canEdit}
          canDelete={canDelete}
          onDelete={(dept) => setDeletingDept(dept)}
          toolbar={
            <TableToolbar
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search departments by name, code, manager..."
              filters={
                <FilterPanel
                  activeFilterCount={activeFiltersCount}
                  onReset={handleResetFilters}
                >
                  <div className="w-36">
                    <Select
                      options={STATUS_FILTER_OPTIONS}
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="py-1 text-xs"
                    />
                  </div>

                  <div className="w-44">
                    <Select
                      options={branchFilterOptions}
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                      className="py-1 text-xs"
                    />
                  </div>
                </FilterPanel>
              }
            />
          }
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingDept)}
        title="Delete Department"
        message={`Are you sure you want to delete department "${deletingDept?.name}" (${deletingDept?.code})? This action cannot be undone.`}
        confirmLabel="Delete Department"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingDept(null)}
      />
    </div>
  );
}
