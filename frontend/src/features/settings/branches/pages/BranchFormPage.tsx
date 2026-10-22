import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Button } from '@/shared/components/common/Button';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { appToast } from '@/shared/utils/toast';
import { useBranches } from '@/features/settings/branches/hooks/useBranches';
import { useBranch } from '@/features/settings/branches/hooks/useBranch';
import { BranchForm } from '@/features/settings/branches/components/BranchForm';
import type { BranchFormValues } from '@/features/settings/branches/schemas/branchSchema';

export function BranchFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const { branch, isLoading: isBranchLoading, error: branchError, refetch } = useBranch(id);
  const { createBranch, updateBranch, isCreating, isUpdating } = useBranches();

  const handleSubmit = async (values: BranchFormValues) => {
    try {
      if (isEditing && id) {
        await updateBranch(id, values);
        appToast.success(`Branch "${values.name}" updated successfully.`);
        navigate(`/settings/branches/${id}`);
      } else {
        const created = await createBranch(values);
        appToast.success(`Branch "${created.name}" created successfully.`);
        navigate('/settings/branches');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save branch.';
      appToast.error(msg);
    }
  };

  if (isEditing && isBranchLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isEditing && (branchError || !branch)) {
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
          message={branchError || `Could not find a branch with ID "${id}".`}
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
          onClick={() => navigate(isEditing && id ? `/settings/branches/${id}` : '/settings/branches')}
        >
          {isEditing ? 'Back to Details' : 'Back to Branches'}
        </Button>
      </div>

      <PageHeader
        title={isEditing ? `Edit Branch: ${branch?.name}` : 'Add New Branch'}
        description={
          isEditing
            ? 'Update branch operational parameters, contact details, and facility address.'
            : 'Register a new operational office, retail store, warehouse, or regional headquarters.'
        }
      />

      <BranchForm
        mode={isEditing ? 'edit' : 'create'}
        initialData={branch}
        onSubmit={handleSubmit}
        onCancel={() => navigate(isEditing && id ? `/settings/branches/${id}` : '/settings/branches')}
        isLoading={isCreating || isUpdating}
      />
    </div>
  );
}
