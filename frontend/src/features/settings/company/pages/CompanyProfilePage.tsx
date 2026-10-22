import { PageHeader } from '@/shared/components/layout/PageHeader';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { appToast } from '@/shared/utils/toast';
import { usePermissions } from '@/core/permissions/permission-context';
import { PERMISSIONS } from '@/core/permissions/permissionConstants';
import { useCompany } from '@/features/settings/company/hooks/useCompany';
import { CompanyProfileForm } from '@/features/settings/company/components/CompanyProfileForm';
import type { CompanyFormValues } from '@/features/settings/company/schemas/companySchema';

export function CompanyProfilePage() {
  const { hasPermission } = usePermissions();
  const canEdit =
    hasPermission(PERMISSIONS.SETTINGS.COMPANY_EDIT) ||
    hasPermission(PERMISSIONS.SETTINGS.COMPANY_CONFIGURE);

  const { company, isLoading, error, refetch, updateCompany, isUpdating } = useCompany();

  const handleSubmit = async (values: CompanyFormValues) => {
    try {
      await updateCompany(values);
      appToast.success('Company profile updated successfully.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update company profile.';
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

  if (error || !company) {
    return (
      <ErrorState
        title="Failed to Load Company Profile"
        message={error || 'No company profile record found.'}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Profile"
        description="Manage the organization's basic company information and business details."
      />

      <CompanyProfileForm
        initialData={company}
        onSubmit={handleSubmit}
        isLoading={isUpdating}
        canEdit={canEdit}
      />
    </div>
  );
}
