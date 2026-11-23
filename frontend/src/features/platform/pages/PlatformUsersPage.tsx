import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Shield, ShieldAlert } from 'lucide-react';
import { platformUserSchema } from '@/features/platform/schemas/platformSchemas';
import type { PlatformRole, PlatformUserInput, PlatformUserRecord } from '@/features/platform/types/platform';
import { platformService } from '@/features/platform/services/platformService';
import { usePlatformFoundation, usePlatformMutation } from '@/features/platform/hooks/usePlatformFoundation';
import { PLATFORM_PERMISSIONS } from '@/core/permissions';
import { usePermissions } from '@/core/permissions/permission-context';
import { PageContainer } from '@/shared/components/layout/PageContainer';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { DataTable } from '@/shared/components/tables/DataTable';
import type { Column } from '@/shared/components/tables/TableHeader';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { Button } from '@/shared/components/common/Button';
import { Modal } from '@/shared/components/common/Modal';
import { FormField } from '@/shared/components/forms/FormField';
import { TextInput } from '@/shared/components/forms/TextInput';
import { Select } from '@/shared/components/forms/Select';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { appToast } from '@/shared/utils/toast';

const PLATFORM_ROLES: { value: PlatformRole; label: string; description: string }[] = [
  {
    value: 'Platform Administrator',
    label: 'Platform Administrator',
    description: 'Full access to the entire Quick ERP platform console (tenants, subscriptions, users, settings, and logs).',
  },
  {
    value: 'Support',
    label: 'Support',
    description: 'Access restricted strictly to viewing, responding to, and managing support tickets.',
  },
];

type UserFormData = {
  name: string;
  email: string;
  role: PlatformRole;
  status: 'active' | 'inactive';
};

const defaultValues: UserFormData = {
  name: '',
  email: '',
  role: 'Support',
  status: 'active',
};

export function PlatformUsersPage() {
  const query = usePlatformFoundation();
  const { hasPermission } = usePermissions();
  const canManage =
    hasPermission(PLATFORM_PERMISSIONS.SUPER_ADMIN.USERS_CONFIGURE) ||
    hasPermission(PLATFORM_PERMISSIONS.SUPER_ADMIN.USERS_EDIT);

  const [editing, setEditing] = useState<PlatformUserRecord | null | undefined>();
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<PlatformUserRecord | null>(null);

  const form = useForm<UserFormData>({
    resolver: zodResolver(platformUserSchema),
    defaultValues,
  });

  const saveMutation = usePlatformMutation((input: PlatformUserInput) =>
    platformService.saveUser(input, editing?.id),
  );
  const deleteMutation = usePlatformMutation((userId: string) => platformService.deleteUser(userId));
  const resendMutation = usePlatformMutation((userId: string) => platformService.resendUserInvitation(userId));

  const isSeedAdmin = Boolean(editing?.isSeed || editing?.id === 'platform-user-001');

  const openModal = (user?: PlatformUserRecord) => {
    setEditing(user ?? null);
    if (user) {
      form.reset({
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      });
    } else {
      form.reset(defaultValues);
    }
  };

  const selectedRole = form.watch('role');

  const columns: Column<PlatformUserRecord>[] = [
    {
      key: 'name',
      header: 'Platform staff',
      render: (r) => (
        <div>
          <div className="flex items-center gap-2">
            <strong className="text-slate-900">{r.name}</strong>
            {(r.isSeed || r.id === 'platform-user-001') && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                <Shield size={12} />
                Seed Admin
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">{r.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Platform role',
      render: (r) => (
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
            r.role === 'Platform Administrator'
              ? 'bg-purple-100 text-purple-800'
              : 'bg-blue-100 text-blue-800'
          }`}
        >
          {r.role}
        </span>
      ),
    },
    {
      key: 'permissions',
      header: 'Permission scope',
      render: (r) =>
        r.role === 'Platform Administrator' ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            Full platform access (*)
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
            Support tickets only
          </span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'last',
      header: 'Last active',
      render: (r) => (r.lastActiveAt ? new Date(r.lastActiveAt).toLocaleString() : 'Never'),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Platform Users & RBAC"
        description="Quick Solutions staff identities, strictly segregated from tenant users and companies."
        actions={
          canManage ? (
            <Button leftIcon={<Plus size={15} />} onClick={() => openModal()}>
              Create Platform User
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={query.data?.users ?? []}
        keyField="id"
        isLoading={query.isLoading}
        emptyTitle="No platform staff"
        rowActions={(r) => {
          if (!canManage) return [];
          const actions = [
            {
              key: 'edit',
              label: 'Edit platform access',
              onClick: () => openModal(r),
            },
            {
              key: 'resend-invitation',
              label: 'Send password setup email',
              onClick: async () => {
                try {
                  await resendMutation.mutateAsync(r.id);
                  appToast.success(`Password setup email sent to ${r.email}.`);
                } catch (error) {
                  appToast.error(error instanceof Error ? error.message : 'Unable to send the password setup email.');
                }
              },
            },
          ];
          // Seed admin account cannot be deleted
          if (!r.isSeed && r.id !== 'platform-user-001') {
            actions.push({
              key: 'delete',
              label: 'Delete user',
              onClick: () => setDeleteConfirmUser(r),
            });
          }
          return actions;
        }}
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={editing !== undefined}
        title={editing ? 'Edit platform user' : 'Create platform user'}
        onClose={() => setEditing(undefined)}
      >
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            try {
              if (isSeedAdmin && values.status === 'inactive') {
                appToast.error('The seed administrator account cannot be deactivated.');
                return;
              }
              const saved = await saveMutation.mutateAsync({
                ...values,
                role: isSeedAdmin ? 'Platform Administrator' : values.role,
                status: isSeedAdmin ? 'active' : values.status,
              });
              setEditing(undefined);
              if (!editing && saved.invitationSent) appToast.success(`Platform user created. Password setup email sent to ${saved.email}.`);
              else if (!editing && values.status === 'active') appToast.success('Platform user created, but the password setup email was not sent. Use the row action to resend it.');
              else appToast.success('Platform user saved.');
            } catch (error) {
              appToast.error(error instanceof Error ? error.message : 'Unable to save user.');
            }
          })}
        >
          {isSeedAdmin && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <strong>Primary Seed Administrator:</strong> This core platform account is protected and cannot be deactivated or deleted.
              </div>
            </div>
          )}

          <FormField label="Name" error={form.formState.errors.name?.message}>
            <TextInput {...form.register('name')} />
          </FormField>

          <FormField label="Email" error={form.formState.errors.email?.message}>
            <TextInput type="email" {...form.register('email')} />
          </FormField>

          <FormField label="Platform role" error={form.formState.errors.role?.message}>
            <Select
              {...form.register('role')}
              disabled={isSeedAdmin}
              options={PLATFORM_ROLES.map((role) => ({
                value: role.value,
                label: role.label,
              }))}
            />
          </FormField>

          {/* Role access explanation banner */}
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Access Scope: </span>
            {selectedRole === 'Platform Administrator' ? (
              <span>Full administrator access across all platform screens, tenants, subscriptions, settings, and logs.</span>
            ) : (
              <span>Restricted strictly to viewing, responding to, and managing support tickets. No access to tenant management or platform settings.</span>
            )}
          </div>

          <FormField label="Status" error={form.formState.errors.status?.message}>
            <Select
              {...form.register('status')}
              disabled={isSeedAdmin}
              options={
                isSeedAdmin
                  ? [{ value: 'active', label: 'Active (Protected)' }]
                  : [
                      { value: 'active', label: 'Active' },
                      { value: 'inactive', label: 'Inactive' },
                    ]
              }
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(undefined)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              {editing ? 'Save Changes' : 'Create User'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteConfirmUser)}
        title="Delete platform user?"
        message={`Are you sure you want to delete ${deleteConfirmUser?.name} (${deleteConfirmUser?.email})? This action cannot be undone.`}
        variant="danger"
        confirmLabel="Delete User"
        onCancel={() => setDeleteConfirmUser(null)}
        onConfirm={async () => {
          if (!deleteConfirmUser) return;
          try {
            await deleteMutation.mutateAsync(deleteConfirmUser.id);
            setDeleteConfirmUser(null);
            appToast.success('Platform user deleted.');
          } catch (error) {
            appToast.error(error instanceof Error ? error.message : 'Unable to delete user.');
          }
        }}
      />
    </PageContainer>
  );
}
