import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Button } from '@/shared/components/common/Button';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { appToast } from '@/shared/utils/toast';
import { useDepartments } from '@/features/settings/organization/hooks/useDepartments';
import { useDepartment } from '@/features/settings/organization/hooks/useDepartment';
import { DepartmentForm } from '@/features/settings/organization/components/DepartmentForm';
import type { DepartmentFormValues } from '@/features/settings/organization/schemas/departmentSchema';

export function DepartmentFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const { department, isLoading: isDeptLoading, error: deptError, refetch } = useDepartment(id);
  const { createDepartment, updateDepartment, isCreating, isUpdating } = useDepartments();

  const handleSubmit = async (values: DepartmentFormValues) => {
    try {
      if (isEditing && id) {
        await updateDepartment(id, values);
        appToast.success(`Department "${values.name}" updated successfully.`);
        navigate(`/settings/departments/${id}`);
      } else {
        const created = await createDepartment(values);
        appToast.success(`Department "${created.name}" created successfully.`);
        navigate('/settings/departments');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save department.';
      appToast.error(msg);
    }
  };

  if (isEditing && isDeptLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isEditing && (deptError || !department)) {
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
          message={deptError || `Could not find a department with ID "${id}".`}
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
          onClick={() => navigate(isEditing && id ? `/settings/departments/${id}` : '/settings/departments')}
        >
          {isEditing ? 'Back to Details' : 'Back to Departments'}
        </Button>
      </div>

      <PageHeader
        title={isEditing ? `Edit Department: ${department?.name}` : 'Add New Department'}
        description={
          isEditing
            ? 'Update department head, operational branch, and scope of responsibilities.'
            : 'Define a new organizational department, function division, or operational unit.'
        }
      />

      <DepartmentForm
        mode={isEditing ? 'edit' : 'create'}
        initialData={department}
        onSubmit={handleSubmit}
        onCancel={() => navigate(isEditing && id ? `/settings/departments/${id}` : '/settings/departments')}
        isLoading={isCreating || isUpdating}
      />
    </div>
  );
}
