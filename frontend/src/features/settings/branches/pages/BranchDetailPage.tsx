import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Button } from '@/shared/components/common/Button';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { appToast } from '@/shared/utils/toast';
import { usePermissions } from '@/core/permissions/permission-context';
import { PERMISSIONS } from '@/core/permissions/permissionConstants';
import { useBranch } from '@/features/settings/branches/hooks/useBranch';
import { useBranches } from '@/features/settings/branches/hooks/useBranches';
import { BranchDetailView } from '@/features/settings/branches/components/BranchDetailView';

export function BranchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  const canEdit = hasPermission(PERMISSIONS.SETTINGS.BRANCHES_EDIT);
  const canDelete = hasPermission(PERMISSIONS.SETTINGS.BRANCHES_DELETE);

  const { branch, isLoading, error, refetch } = useBranch(id);
  const { deleteBranch, isDeleting } = useBranches();

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!branch) return;
    try {
      await deleteBranch(branch.id);
      appToast.success(`Branch "${branch.name}" has been deleted.`);
      setIsDeleteOpen(false);
      navigate('/settings/branches');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete branch.';
      appToast.error(msg);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !branch) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft size={16} />}
          onClick={() => navigate('/settings/branches')}
        >
          Back to Branches
        </Button>
        <ErrorState
          title="Branch Not Found"
          message={error || `No branch exists with ID "${id}".`}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft size={16} />}
          onClick={() => navigate('/settings/branches')}
        >
          Back to Branches
        </Button>
      </div>

      <PageHeader
        title={branch.name}
        description={`Branch Code: ${branch.code} • ${branch.city || 'Location unassigned'}`}
        actions={
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button
                variant="secondary"
                leftIcon={<Edit size={16} />}
                onClick={() => navigate(`/settings/branches/${branch.id}/edit`)}
              >
                Edit Branch
              </Button>
            )}

            {canDelete && !branch.isMain && (
              <Button
                variant="secondary"
                leftIcon={<Trash2 size={16} className="text-red-500" />}
                onClick={() => setIsDeleteOpen(true)}
              >
                Delete
              </Button>
            )}
          </div>
        }
      />

      <BranchDetailView branch={branch} />

      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Delete Branch"
        message={
          branch.isMain
            ? 'This branch is designated as the primary headquarters and cannot be deleted.'
            : `Are you sure you want to permanently delete branch "${branch.name}" (${branch.code})? This action cannot be undone.`
        }
        confirmLabel="Delete Branch"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsDeleteOpen(false)}
      />
    </div>
  );
}
