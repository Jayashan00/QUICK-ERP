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
import { useDepartment } from '@/features/settings/organization/hooks/useDepartment';
import { useDepartments } from '@/features/settings/organization/hooks/useDepartments';
import { DepartmentDetailView } from '@/features/settings/organization/components/DepartmentDetailView';

export function DepartmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  const canEdit = hasPermission(PERMISSIONS.SETTINGS.DEPARTMENTS_EDIT);
  const canDelete = hasPermission(PERMISSIONS.SETTINGS.DEPARTMENTS_DELETE);

  const { department, isLoading, error, refetch } = useDepartment(id);
  const { deleteDepartment, isDeleting } = useDepartments();

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!department) return;
    try {
      await deleteDepartment(department.id);
      appToast.success(`Department "${department.name}" has been deleted.`);
      setIsDeleteOpen(false);
      navigate('/settings/departments');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete department.';
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

  if (error || !department) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft size={16} />}
          onClick={() => navigate('/settings/departments')}
        >
          Back to Departments
        </Button>
        <ErrorState
          title="Department Not Found"
          message={error || `No department exists with ID "${id}".`}
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
          onClick={() => navigate('/settings/departments')}
        >
          Back to Departments
        </Button>
      </div>

      <PageHeader
        title={department.name}
        description={`Department Code: ${department.code} • ${department.branchName || 'Enterprise-wide'}`}
        actions={
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button
                variant="secondary"
                leftIcon={<Edit size={16} />}
                onClick={() => navigate(`/settings/departments/${department.id}/edit`)}
              >
                Edit Department
              </Button>
            )}

            {canDelete && (
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

      <DepartmentDetailView department={department} />

      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Delete Department"
        message={`Are you sure you want to permanently delete department "${department.name}" (${department.code})? This action cannot be undone.`}
        confirmLabel="Delete Department"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsDeleteOpen(false)}
      />
    </div>
  );
}
