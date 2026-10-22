import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save } from 'lucide-react';
import { Card } from '@/shared/components/common/Card';
import { Button } from '@/shared/components/common/Button';
import { FormField } from '@/shared/components/forms/FormField';
import { TextInput } from '@/shared/components/forms/TextInput';
import { Textarea } from '@/shared/components/forms/Textarea';
import { Select } from '@/shared/components/forms/Select';
import { Switch } from '@/shared/components/forms/Switch';
import { FormSection } from '@/shared/components/forms/FormSection';
import type { Department } from '@/features/settings/organization/types/department';
import { departmentSchema, type DepartmentFormValues } from '@/features/settings/organization/schemas/departmentSchema';
import { useBranchOptions } from '@/features/settings/branches/hooks/useBranchOptions';
import { useUserOptions } from '@/features/settings/users/hooks/useUserOptions';

interface DepartmentFormProps {
  mode: 'create' | 'edit';
  initialData?: Department | null;
  onSubmit: (data: DepartmentFormValues) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DepartmentForm({
  mode,
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: DepartmentFormProps) {
  const { users, isLoading: areUsersLoading } = useUserOptions();
  const { branches, isLoading: areBranchesLoading } = useBranchOptions({ includeInactive: true });
  const managerOptions = [
    { value: '', label: 'Unassigned / Select Head' },
    ...users.map((user) => ({
      value: user.id,
      label: `${user.name} (${user.jobTitle || user.roleName})`,
    })),
  ];
  const branchOptions = [
    { value: '', label: 'All Branches (Enterprise-wide)' },
    ...branches.map((branch) => ({
      value: branch.id,
      label: `${branch.name} (${branch.code})${branch.isActive ? '' : ' - Inactive'}`,
    })),
  ];
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: initialData?.name || '',
      code: initialData?.code || '',
      description: initialData?.description || '',
      managerId: initialData?.managerId || '',
      managerName: initialData?.managerName || '',
      branchId: initialData?.branchId || '',
      branchName: initialData?.branchName || '',
      status: initialData?.status || 'active',
    },
  });

  const handleManagerChange = (managerId: string) => {
    setValue('managerId', managerId);
    const selected = users.find((user) => user.id === managerId);
    setValue('managerName', selected ? selected.name : '');
  };

  const handleBranchChange = (branchId: string) => {
    setValue('branchId', branchId);
    const selected = branches.find((branch) => branch.id === branchId);
    setValue('branchName', selected ? selected.name : '');
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* Department Info */}
        <FormSection
          title="Department Profile"
          description="Basic operational definition and reporting hierarchy."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Department Name"
              htmlFor="dept-name"
              required
              error={errors.name?.message}
            >
              <TextInput
                id="dept-name"
                disabled={isSubmitting || isLoading}
                error={Boolean(errors.name)}
                placeholder="e.g. Engineering or Human Resources"
                {...register('name')}
              />
            </FormField>

            <FormField
              label="Department Code"
              htmlFor="dept-code"
              required
              error={errors.code?.message}
            >
              <TextInput
                id="dept-code"
                disabled={isSubmitting || isLoading}
                error={Boolean(errors.code)}
                placeholder="e.g. ENG, HR, or FIN"
                {...register('code')}
              />
            </FormField>

            <FormField
              label="Department Head / Lead"
              htmlFor="dept-manager"
              error={errors.managerId?.message}
            >
              <Controller
                name="managerId"
                control={control}
                render={({ field }) => (
                  <Select
                    id="dept-manager"
                    options={managerOptions}
                    value={field.value || ''}
                    onChange={(e) => handleManagerChange(e.target.value)}
                    disabled={isSubmitting || isLoading || areUsersLoading}
                    error={Boolean(errors.managerId)}
                  />
                )}
              />
            </FormField>

            <FormField
              label="Assigned Branch / Location"
              htmlFor="dept-branch"
              error={errors.branchId?.message}
            >
              <Controller
                name="branchId"
                control={control}
                render={({ field }) => (
                  <Select
                    id="dept-branch"
                    options={branchOptions}
                    value={field.value || ''}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    disabled={isSubmitting || isLoading || areBranchesLoading}
                    error={Boolean(errors.branchId)}
                  />
                )}
              />
            </FormField>

            <div className="sm:col-span-2">
              <FormField
                label="Department Description"
                htmlFor="dept-desc"
                error={errors.description?.message}
              >
                <Textarea
                  id="dept-desc"
                  rows={3}
                  disabled={isSubmitting || isLoading}
                  error={Boolean(errors.description)}
                  placeholder="Summarize the core roles, functions, and responsibilities of this department."
                  {...register('description')}
                />
              </FormField>
            </div>

            <div className="pt-1">
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Switch
                    id="dept-status"
                    checked={field.value === 'active'}
                    onChange={(e) => field.onChange(e.target.checked ? 'active' : 'inactive')}
                    disabled={isSubmitting || isLoading}
                    label="Active Department Status"
                  />
                )}
              />
            </div>
          </div>
        </FormSection>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-5">
          <Button
            type="button"
            variant="secondary"
            disabled={isSubmitting || isLoading}
            onClick={onCancel}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            leftIcon={<Save size={16} />}
            isLoading={isSubmitting || isLoading}
          >
            {mode === 'create' ? 'Create Department' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
