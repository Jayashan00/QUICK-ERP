import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/components/common/Button';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { appToast } from '@/shared/utils/toast';
import { UserForm } from '@/features/settings/users/components/UserForm';
import { useUser } from '@/features/settings/users/hooks/useUser';
import { useUsers } from '@/features/settings/users/hooks/useUsers';
import { useTenant } from '@/core/tenant/tenant-context';
import type { UserFormValues } from '@/features/settings/users/schemas/userSchema';

export function UserFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const detail = useUser(id);
  const mutations = useUsers();
  const { currentTenant } = useTenant();

  const maxUsers = currentTenant?.entitlements.limits.maxUsers ?? 0;
  const currentUsers = mutations.userCount ?? currentTenant?.entitlements.usage.currentUsers ?? 0;
  const limitReached = !editing && Boolean(currentTenant && currentUsers >= maxUsers);

  if (editing && detail.isLoading) return <div className="flex h-64 items-center justify-center"><LoadingSpinner /></div>;
  if (editing && (detail.error || !detail.user)) return <ErrorState title="Team Member Not Found" message={detail.error ?? 'User not found.'} />;

  const submit = async (values: UserFormValues) => {
    if (limitReached) {
      appToast.error(`Maximum user limit reached (${currentUsers} / ${maxUsers}). Contact Super Admin to increase your limit.`);
      return;
    }
    try {
      if (id) {
        await mutations.updateUser(id, values);
        appToast.success('Team member updated.');
        navigate(`/settings/users/${id}`);
      } else {
        await mutations.createUser({ ...values, isSuperAdmin: false });
        appToast.success('Team member created.');
        navigate('/settings/users');
      }
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : 'Unable to save team member.');
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate(id ? `/settings/users/${id}` : '/settings/users')}>
        Back
      </Button>
      <PageHeader
        title={editing ? `Edit Team Member: ${detail.user?.name}` : 'Add Team Member'}
        description="Assign a tenant role and one or more allowed branches."
      />
      {limitReached && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">Company user limit reached ({currentUsers} / {maxUsers})</p>
          <p className="mt-1 text-xs">
            Your company has reached the maximum user limit configured by Quick Solutions Super Admin. You cannot create additional team members.
          </p>
        </div>
      )}
      <UserForm
        initialData={detail.user}
        onSubmit={submit}
        onCancel={() => navigate(id ? `/settings/users/${id}` : '/settings/users')}
        isLoading={mutations.isSaving}
        disabled={limitReached}
      />
    </div>
  );
}
