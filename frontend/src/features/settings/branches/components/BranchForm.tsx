import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save } from 'lucide-react';
import { Card } from '@/shared/components/common/Card';
import { Button } from '@/shared/components/common/Button';
import { FormField } from '@/shared/components/forms/FormField';
import { TextInput } from '@/shared/components/forms/TextInput';
import { Select } from '@/shared/components/forms/Select';
import { Switch } from '@/shared/components/forms/Switch';
import { FormSection } from '@/shared/components/forms/FormSection';
import type { Branch } from '@/core/branch/types/branch';
import { branchSchema, type BranchFormValues } from '@/features/settings/branches/schemas/branchSchema';
import { useUserOptions } from '@/features/settings/users/hooks/useUserOptions';

interface BranchFormProps {
  mode: 'create' | 'edit';
  initialData?: Branch | null;
  onSubmit: (data: BranchFormValues) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function BranchForm({
  mode,
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: BranchFormProps) {
  const { users, isLoading: areUsersLoading } = useUserOptions();
  const managerOptions = [
    { value: '', label: 'None / Select Manager' },
    ...users.map((user) => ({
      value: user.id,
      label: `${user.name} (${user.jobTitle || user.roleName})`,
    })),
  ];
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BranchFormValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: initialData?.name || '',
      code: initialData?.code || '',
      isMain: initialData?.isMain ?? false,
      phone: initialData?.phone || '',
      email: initialData?.email || '',
      address: initialData?.address || '',
      city: initialData?.city || '',
      state: initialData?.state || '',
      postalCode: initialData?.postalCode || '',
      country: initialData?.country || 'United States',
      managerId: initialData?.managerId || '',
      managerName: initialData?.managerName || '',
      isActive: initialData?.isActive ?? true,
    },
  });

  const handleManagerChange = (managerId: string) => {
    setValue('managerId', managerId);
    const selected = users.find((user) => user.id === managerId);
    setValue('managerName', selected ? selected.name : '');
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* Branch General Info */}
        <FormSection
          title="Branch Identity"
          description="Basic operational identification for this facility or office."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Branch Name"
              htmlFor="branch-name"
              required
              error={errors.name?.message}
            >
              <TextInput
                id="branch-name"
                disabled={isSubmitting || isLoading}
                error={Boolean(errors.name)}
                placeholder="e.g. West Branch or City Outlet"
                {...register('name')}
              />
            </FormField>

            <FormField
              label="Branch Code"
              htmlFor="branch-code"
              required
              error={errors.code?.message}
            >
              <TextInput
                id="branch-code"
                disabled={isSubmitting || isLoading}
                error={Boolean(errors.code)}
                placeholder="e.g. WEST or NY-01"
                {...register('code')}
              />
            </FormField>

            <FormField
              label="Branch Manager / Lead"
              htmlFor="branch-manager"
              error={errors.managerId?.message}
            >
              <Controller
                name="managerId"
                control={control}
                render={({ field }) => (
                  <Select
                    id="branch-manager"
                    options={managerOptions}
                    value={field.value || ''}
                    onChange={(e) => handleManagerChange(e.target.value)}
                    disabled={isSubmitting || isLoading || areUsersLoading}
                    error={Boolean(errors.managerId)}
                  />
                )}
              />
            </FormField>

            <div className="flex flex-col justify-center space-y-3 pt-2">
              <Controller
                name="isMain"
                control={control}
                render={({ field }) => (
                  <Switch
                    id="branch-is-main"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    disabled={isSubmitting || isLoading}
                    label="Primary / Main Branch (Headquarters)"
                  />
                )}
              />

              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <Switch
                    id="branch-is-active"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    disabled={isSubmitting || isLoading}
                    label="Active Status"
                  />
                )}
              />
            </div>
          </div>
        </FormSection>

        {/* Contact Info */}
        <FormSection
          title="Contact Information"
          description="Branch-specific communication lines."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Branch Phone"
              htmlFor="branch-phone"
              error={errors.phone?.message}
            >
              <TextInput
                id="branch-phone"
                disabled={isSubmitting || isLoading}
                error={Boolean(errors.phone)}
                placeholder="+1 (555) 000-0000"
                {...register('phone')}
              />
            </FormField>

            <FormField
              label="Branch Email"
              htmlFor="branch-email"
              error={errors.email?.message}
            >
              <TextInput
                id="branch-email"
                type="email"
                disabled={isSubmitting || isLoading}
                error={Boolean(errors.email)}
                placeholder="branch@company.com"
                {...register('email')}
              />
            </FormField>
          </div>
        </FormSection>

        {/* Address */}
        <FormSection
          title="Branch Location & Physical Address"
          description="Geographical location and delivery address."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField
                label="Street Address"
                htmlFor="branch-street"
                error={errors.address?.message}
              >
                <TextInput
                  id="branch-street"
                  disabled={isSubmitting || isLoading}
                  error={Boolean(errors.address)}
                  placeholder="Street address or facility number"
                  {...register('address')}
                />
              </FormField>
            </div>

            <FormField label="City" htmlFor="branch-city" error={errors.city?.message}>
              <TextInput
                id="branch-city"
                disabled={isSubmitting || isLoading}
                error={Boolean(errors.city)}
                placeholder="e.g. Los Angeles"
                {...register('city')}
              />
            </FormField>

            <FormField
              label="State / Province"
              htmlFor="branch-state"
              error={errors.state?.message}
            >
              <TextInput
                id="branch-state"
                disabled={isSubmitting || isLoading}
                error={Boolean(errors.state)}
                placeholder="e.g. CA"
                {...register('state')}
              />
            </FormField>

            <FormField
              label="Postal / ZIP Code"
              htmlFor="branch-postal"
              error={errors.postalCode?.message}
            >
              <TextInput
                id="branch-postal"
                disabled={isSubmitting || isLoading}
                error={Boolean(errors.postalCode)}
                placeholder="e.g. 90001"
                {...register('postalCode')}
              />
            </FormField>

            <FormField
              label="Country"
              htmlFor="branch-country"
              error={errors.country?.message}
            >
              <TextInput
                id="branch-country"
                disabled={isSubmitting || isLoading}
                error={Boolean(errors.country)}
                placeholder="e.g. United States"
                {...register('country')}
              />
            </FormField>
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
            {mode === 'create' ? 'Create Branch' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
