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
import type { Branch } from '@/core/branch/types/branch';
import { useBranches } from '@/features/settings/branches/hooks/useBranches';
import { BranchTable } from '@/features/settings/branches/components/BranchTable';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const MAIN_FILTER_OPTIONS = [
  { value: 'all', label: 'All Branches' },
  { value: 'true', label: 'HQ / Main Only' },
  { value: 'false', label: 'Regional Branches' },
];

export function BranchListPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  const canCreate = hasPermission(PERMISSIONS.SETTINGS.BRANCHES_CREATE);
  const canEdit = hasPermission(PERMISSIONS.SETTINGS.BRANCHES_EDIT);
  const canDelete = hasPermission(PERMISSIONS.SETTINGS.BRANCHES_DELETE);

  const {
    branches,
    total,
    isLoading,
    error,
    refetch,
    search,
    setSearch,
    status,
    setStatus,
    isMain,
    setIsMain,
    page,
    setPage,
    pageSize,
    setPageSize,
    deleteBranch,
    isDeleting,
  } = useBranches();

  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);

  const handleDeleteConfirm = async () => {
    if (!deletingBranch) return;
    try {
      await deleteBranch(deletingBranch.id);
      appToast.success(`Branch "${deletingBranch.name}" has been deleted.`);
      setDeletingBranch(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete branch.';
      appToast.error(msg);
    }
  };

  const activeFiltersCount = (status !== 'all' ? 1 : 0) + (isMain !== 'all' ? 1 : 0);

  const handleResetFilters = () => {
    setStatus('all');
    setIsMain('all');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branches"
        description="Manage company branches and their basic operational information."
        actions={
          canCreate ? (
            <Button
              variant="primary"
              leftIcon={<Plus size={16} />}
              onClick={() => navigate('/settings/branches/new')}
            >
              Add Branch
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <ErrorState
          title="Error Loading Branches"
          message={error}
          onRetry={() => void refetch()}
        />
      ) : (
        <BranchTable
          branches={branches}
          isLoading={isLoading}
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          canEdit={canEdit}
          canDelete={canDelete}
          onDelete={(branch) => setDeletingBranch(branch)}
          toolbar={
            <TableToolbar
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search branches by name, code, manager, city..."
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

                  <div className="w-40">
                    <Select
                      options={MAIN_FILTER_OPTIONS}
                      value={isMain}
                      onChange={(e) => setIsMain(e.target.value)}
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
        isOpen={Boolean(deletingBranch)}
        title="Delete Branch"
        message={
          deletingBranch?.isMain
            ? 'This branch is designated as the primary headquarters and cannot be deleted.'
            : `Are you sure you want to delete branch "${deletingBranch?.name}" (${deletingBranch?.code})? This action cannot be undone.`
        }
        confirmLabel="Delete Branch"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingBranch(null)}
      />
    </div>
  );
}
