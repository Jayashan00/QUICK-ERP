import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Save, ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { Select } from '@/shared/components/forms/Select';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { PERMISSIONS } from '@/core/permissions';
import { appToast } from '@/shared/utils/toast';
import { usePermissions } from '@/core/permissions/permission-context';
import { usePermissionMatrix } from '@/features/settings/roles/hooks/usePermissionMatrix';
import { useRoleOptions } from '@/features/settings/roles/hooks/useRoleOptions';
import { MATRIX_ACTIONS } from '@/features/settings/roles/services/permissionMatrixService';

const actionLabels: Record<(typeof MATRIX_ACTIONS)[number], string> = {
  view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete', approve: 'Approve',
  export: 'Export', print: 'Print', configure: 'Configure', test: 'Test',
};

export function PermissionMatrixPage() {
  const [params, setParams] = useSearchParams();
  const { hasPermission } = usePermissions();
  const { roles, isLoading: rolesLoading } = useRoleOptions(true);
  const [roleId, setRoleId] = useState(params.get('roleId') ?? '');
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const matrix = usePermissionMatrix(roleId);
  const canConfigure = hasPermission(PERMISSIONS.SETTINGS.PERMISSIONS_CONFIGURE) || hasPermission(PERMISSIONS.SETTINGS.PERMISSIONS_EDIT);

  useEffect(() => {
    const requested = params.get('roleId');
    if (requested && requested !== roleId) setRoleId(requested);
  }, [params, roleId]);

  const setRole = (value: string) => {
    setRoleId(value);
    setExpandedModules([]);
    setParams(value ? { roleId: value } : {}, { replace: true });
  };

  const togglePermission = (permission: string) => {
    matrix.setSelected(matrix.selected.includes(permission)
      ? matrix.selected.filter((item) => item !== permission)
      : [...matrix.selected, permission]);
  };

  const toggleModule = (modulePermissions: string[], enabled: boolean) => {
    matrix.setSelected(enabled
      ? [...new Set([...matrix.selected, ...modulePermissions])]
      : matrix.selected.filter((permission) => !modulePermissions.includes(permission)));
  };

  return <div className="space-y-6">
    <PageHeader
      title="Permissions"
      description="Choose full module access, or customize only when a role needs limited access."
      actions={canConfigure && roleId ? <Button leftIcon={<Save size={16} />} isLoading={matrix.isSaving} onClick={async () => {
        try {
          await matrix.save();
          appToast.success('Role permissions saved.');
        } catch (error) {
          appToast.error(error instanceof Error ? error.message : 'Unable to save permissions.');
        }
      }}>Save Permissions</Button> : undefined}
    />

    <Card>
      <div className="max-w-md">
        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Role</label>
        <Select value={roleId} onChange={(event) => setRole(event.target.value)} disabled={rolesLoading} placeholder="Select a role" options={roles.map((role) => ({ value: role.id, label: `${role.name}${role.isSystem ? ' (Default)' : ' (Custom)'}` }))} />
      </div>
    </Card>

    {!roleId ? <Card className="py-12 text-center">
      <ShieldCheck className="mx-auto text-slate-300" size={36} />
      <p className="mt-3 text-sm text-slate-500">Select a role to review and assign permissions.</p>
    </Card> : matrix.error ? <ErrorState message={matrix.error} /> : matrix.isLoading ? <div className="flex h-48 items-center justify-center"><LoadingSpinner /></div> : <Card className="overflow-hidden p-0">
      <div className="divide-y divide-slate-200">
        {matrix.groups.map((group) => {
          const selectedCount = group.permissions.filter((permission) => matrix.selected.includes(permission)).length;
          const hasFullAccess = selectedCount === group.permissions.length;
          const hasPartialAccess = selectedCount > 0 && !hasFullAccess;
          const expanded = expandedModules.includes(group.module);
          const isPos = group.module === 'pos';

          return <section key={group.module}>
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">{group.label}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {isPos
                    ? 'One access choice covers the complete POS system.'
                    : hasFullAccess ? 'Full module access' : hasPartialAccess ? 'Customized access' : 'No access'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {!isPos && <Button size="sm" variant="ghost" rightIcon={expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />} onClick={() => setExpandedModules(expanded ? expandedModules.filter((module) => module !== group.module) : [...expandedModules, group.module])}>
                  {expanded ? 'Hide details' : 'Customize'}
                </Button>}
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={hasFullAccess} disabled={!canConfigure} onChange={(event) => toggleModule(group.permissions, event.target.checked)} />
                  Full access
                </label>
              </div>
            </div>

            {expanded && !isPos && <div className="overflow-x-auto border-t border-slate-200">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50"><tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Resource</th>
                  {MATRIX_ACTIONS.map((action) => <th key={action} className="px-3 py-3 text-center text-xs font-semibold text-slate-500">{actionLabels[action]}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-slate-100">{group.rows.map((row) => <tr key={row.id}>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{row.label}</td>
                  {MATRIX_ACTIONS.map((action) => {
                    const permission = row.permissions[action];
                    return <td key={action} className="px-3 py-3 text-center">{permission
                      ? <input type="checkbox" checked={matrix.selected.includes(permission)} disabled={!canConfigure} onChange={() => togglePermission(permission)} aria-label={`${row.label} ${actionLabels[action]}`} />
                      : <span className="text-slate-300">—</span>}</td>;
                  })}
                </tr>)}</tbody>
              </table>
            </div>}
          </section>;
        })}
      </div>
    </Card>}
  </div>;
}
