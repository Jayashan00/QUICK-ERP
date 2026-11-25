import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/core/auth/auth-context';
import { securityService } from '@/core/auth/securityService';
import { useTenant } from '@/core/tenant/tenant-context';
import { useBranch } from '@/core/branch/branch-context';
import { changePasswordSchema, type ChangePasswordValues } from '@/features/auth/schemas/securitySchemas';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { FormField } from '@/shared/components/forms/FormField';
import { TextInput } from '@/shared/components/forms/TextInput';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { getErrorMessage } from '@/shared/utils/errors';
import { appToast } from '@/shared/utils/toast';

export function ProfilePage() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { currentBranch, branches } = useBranch();
  const passwordForm = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  if (!user) return null;
  const fields = [
    ['Name', user.name], ['Email', user.email], ['Role', user.roleName],
    ['Phone', user.phone || 'Not provided'],
    ...(!user.isSuperAdmin ? [
      ['Company', currentTenant?.name ?? user.tenantId],
      ['Active branch', currentBranch?.name ?? 'No active branch'],
      ['Assigned branches', user.branchIds.map(id => branches.find(branch => branch.id === id)?.name ?? id).join(', ') || 'No assigned branches'],
    ] : []),
  ];
  return <div className="space-y-6">
    <PageHeader title="My Profile" description="Review your account identity and manage your password." />
    <Card><dl className="grid gap-5 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-900">{value}</dd></div>)}</dl></Card>
    <Card className="max-w-2xl">
      <div className="mb-5 flex items-center gap-3">
        <KeyRound className="text-blue-600" />
        <div><h2 className="font-semibold">Change password</h2><p className="text-sm text-slate-500">Update the password used to sign in to your account.</p></div>
      </div>
      {passwordForm.formState.errors.root?.message && <p role="alert" className="mb-3 text-sm text-red-600">{passwordForm.formState.errors.root.message}</p>}
      <form
        className="space-y-4"
        onSubmit={passwordForm.handleSubmit(async (values) => {
          try {
            await securityService.changePassword(user.id, values.currentPassword, values.newPassword);
            passwordForm.reset();
            appToast.success('Password changed successfully.');
          } catch (error) {
            passwordForm.setError('root', { message: getErrorMessage(error, 'Unable to change password.') });
          }
        })}
        noValidate
      >
        {(['currentPassword', 'newPassword', 'confirmPassword'] as const).map((name) => (
          <FormField key={name} label={name === 'currentPassword' ? 'Current password' : name === 'newPassword' ? 'New password' : 'Confirm new password'} htmlFor={`profile-${name}`} required error={passwordForm.formState.errors[name]?.message}>
            <TextInput id={`profile-${name}`} type="password" autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'} error={Boolean(passwordForm.formState.errors[name])} {...passwordForm.register(name)} />
          </FormField>
        ))}
        <Button type="submit" isLoading={passwordForm.formState.isSubmitting}>Change password</Button>
      </form>
    </Card>
  </div>;
}
