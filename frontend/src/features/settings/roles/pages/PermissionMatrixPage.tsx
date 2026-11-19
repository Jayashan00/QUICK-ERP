import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Save,
  RotateCcw,
  Sparkles,
  Search,
  ShieldCheck,
  ChevronsUpDown,
} from 'lucide-react';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { Select } from '@/shared/components/forms/Select';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { appToast } from '@/shared/utils/toast';
import { usePermissions } from '@/core/permissions/permission-context';
import { PERMISSIONS } from '@/core/permissions';
import { useRoleOptions } from '@/features/settings/roles/hooks/useRoleOptions';
import { usePermissionMatrix } from '@/features/settings/roles/hooks/usePermissionMatrix';
import {
  getSidebarCatalog,
  applyPageLevel,
  applyModuleLevel,
  type SidebarPageDefinition,
  type SidebarModuleDefinition,
} from '../config/sidebarPermissionCatalog';
import { ModulePermissionCard } from '../components/ModulePermissionCard';
import { PermissionSummaryHeader } from '../components/PermissionSummaryHeader';
import { PresetApplyModal } from '../components/PresetApplyModal';
import type { RolePresetDefinition } from '../config/rolePermissionPresets';
import { cn } from '@/shared/utils/cn';

export function PermissionMatrixPage() {
  const [params, setParams] = useSearchParams();
  const { hasPermission } = usePermissions();
  const { roles, isLoading: rolesLoading } = useRoleOptions(true);
  const [roleId, setRoleId] = useState(params.get('roleId') ?? '');

  const [searchQuery, setSearchQuery] = useState('');
  const [accessFilter, setAccessFilter] = useState<'all' | 'accessible' | 'no_access'>('all');
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [forceExpandAll, setForceExpandAll] = useState<boolean | undefined>(undefined);

  const matrix = usePermissionMatrix(roleId);
  const canConfigure =
    hasPermission(PERMISSIONS.SETTINGS.PERMISSIONS_CONFIGURE) ||
    hasPermission(PERMISSIONS.SETTINGS.PERMISSIONS_EDIT);

  const activeRole = useMemo(() => roles.find((r) => r.id === roleId), [roles, roleId]);

  // Sync roleId from URL params or default to first role
  useEffect(() => {
    const requested = params.get('roleId');
    if (requested && requested !== roleId) {
      setRoleId(requested);
    } else if (!roleId && roles.length > 0) {
      const defaultRole = roles.find((r) => r.code === 'admin') ?? roles[0];
      if (defaultRole) {
        setRoleId(defaultRole.id);
        setParams({ roleId: defaultRole.id }, { replace: true });
      }
    }
  }, [params, roleId, roles, setParams]);

  const setRole = (value: string) => {
    setRoleId(value);
    setSearchQuery('');
    setParams(value ? { roleId: value } : {}, { replace: true });
  };

  // Build the sidebar catalog respecting Super Admin-enabled modules
  const sidebarSections = useMemo(
    () => getSidebarCatalog(matrix.enabledModules),
    [matrix.enabledModules],
  );

  const selectedSet = useMemo(() => new Set(matrix.selected), [matrix.selected]);

  // Handle page access level changes
  const handlePageLevelChange = (
    page: SidebarPageDefinition,
    level: 'no_access' | 'view_only' | 'manage' | 'full_access',
  ) => {
    if (!canConfigure) return;
    const updated = applyPageLevel(page, level, matrix.selected);
    matrix.setSelected(updated);
  };

  // Handle granular permission toggle
  const handleTogglePermission = (permission: string) => {
    if (!canConfigure) return;
    if (selectedSet.has(permission)) {
      matrix.setSelected(matrix.selected.filter((p) => p !== permission));
    } else {
      matrix.setSelected([...matrix.selected, permission]);
    }
  };

  // Handle module-level bulk action
  const handleApplyModuleLevel = (
    module: SidebarModuleDefinition,
    level: 'full_access' | 'view_only' | 'no_access',
  ) => {
    if (!canConfigure) return;
    const updated = applyModuleLevel(module, level, matrix.selected);
    matrix.setSelected(updated);
  };

  // Apply a role preset
  const handleApplyPreset = (preset: RolePresetDefinition) => {
    const presetPermissions = preset.resolvePermissions(matrix.enabledModules);
    matrix.setSelected(presetPermissions);
    appToast.success(`Applied ${preset.name} permission preset.`);
  };

  const handleSave = async () => {
    try {
      await matrix.save();
      appToast.success('Role permissions saved successfully.');
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : 'Unable to save permissions.');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Role Permission Management"
        description="Assign page access and granular operational capabilities matching the exact VYRO sidebar navigation."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canConfigure && roleId && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Sparkles size={15} className="text-blue-600" />}
                onClick={() => setIsPresetModalOpen(true)}
              >
                Apply Role Preset...
              </Button>
            )}
            {canConfigure && roleId && matrix.hasChanges && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Save size={15} />}
                isLoading={matrix.isSaving}
                onClick={handleSave}
              >
                Save Changes
              </Button>
            )}
          </div>
        }
      />

      {/* Role Selector and Entitlements Header */}
      <Card className="border-slate-200 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full max-w-md">
            <label htmlFor="role-select" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Select Role to Configure
            </label>
            <Select
              id="role-select"
              value={roleId}
              onChange={(e) => setRole(e.target.value)}
              disabled={rolesLoading}
              placeholder="Select a role"
              options={roles.map((r) => ({
                value: r.id,
                label: `${r.name}${r.isSystem ? ' (Default Role)' : ' (Custom Role)'}`,
              }))}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-lg border border-blue-200 bg-blue-50/70 px-3.5 py-2.5 text-xs text-blue-900">
              <span className="font-semibold">Super Admin Entitlements:</span> Showing only modules enabled by platform administrator ({matrix.enabledModules.length} enabled).
            </div>
            {activeRole && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <ShieldCheck size={16} className="text-emerald-600" />
                <span>
                  <strong>{activeRole.name}</strong> ({activeRole.code}) · {activeRole.assignedUserCount} active user{activeRole.assignedUserCount === 1 ? '' : 's'}
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {!roleId ? (
        <Card className="py-16 text-center">
          <ShieldCheck className="mx-auto text-slate-300" size={44} />
          <h3 className="mt-3 text-base font-semibold text-slate-800">No Role Selected</h3>
          <p className="mt-1 text-sm text-slate-500">
            Please choose a tenant role above to manage its navigation and action permissions.
          </p>
        </Card>
      ) : matrix.error ? (
        <ErrorState message={matrix.error} />
      ) : matrix.isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {/* Permission Metrics Summary Bar */}
          <PermissionSummaryHeader
            sections={sidebarSections}
            selectedPermissions={selectedSet}
          />

          {/* Search and Filters Toolbar */}
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between shadow-2xs">
            <div className="relative min-w-0 flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search modules, pages, or granular permissions..."
                className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setAccessFilter('all')}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                    accessFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  All Pages
                </button>
                <button
                  type="button"
                  onClick={() => setAccessFilter('accessible')}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                    accessFilter === 'accessible'
                      ? 'bg-white text-blue-700 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  Accessible
                </button>
                <button
                  type="button"
                  onClick={() => setAccessFilter('no_access')}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                    accessFilter === 'no_access'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  No Access
                </button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setForceExpandAll(forceExpandAll === true ? false : true)}
                className="text-xs text-slate-600 hover:text-slate-900"
                leftIcon={<ChevronsUpDown size={14} />}
              >
                {forceExpandAll === true ? 'Collapse All' : 'Expand All'}
              </Button>
            </div>
          </div>

          {/* Navigation Sections and Modules in EXACT Sidebar Order */}
          <div className="space-y-8">
            {sidebarSections.map((section) => {
              // Check if any modules in this section have matches
              const visibleModules = section.modules.filter((mod) => {
                if (!searchQuery && accessFilter === 'all') return true;
                return mod.pages.some((page) => {
                  if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    return (
                      page.name.toLowerCase().includes(q) ||
                      page.path.toLowerCase().includes(q) ||
                      mod.name.toLowerCase().includes(q) ||
                      (page.parentGroup?.toLowerCase().includes(q) ?? false) ||
                      page.actions.some((a) => a.label.toLowerCase().includes(q) || a.permission.toLowerCase().includes(q))
                    );
                  }
                  return true;
                });
              });

              if (visibleModules.length === 0) return null;

              return (
                <section key={section.title} className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {section.title}
                    </h2>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>

                  <div className="space-y-4">
                    {visibleModules.map((mod) => (
                      <ModulePermissionCard
                        key={mod.id}
                        module={mod}
                        selectedPermissions={selectedSet}
                        onPageLevelChange={handlePageLevelChange}
                        onTogglePermission={handleTogglePermission}
                        onApplyModuleLevel={handleApplyModuleLevel}
                        disabled={!canConfigure}
                        searchFilter={searchQuery}
                        accessFilter={accessFilter}
                        isForceExpanded={forceExpandAll}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Preset Apply Modal */}
          <PresetApplyModal
            isOpen={isPresetModalOpen}
            onClose={() => setIsPresetModalOpen(false)}
            roleName={activeRole?.name ?? 'Selected Role'}
            hasCustomizations={matrix.selected.length > 0}
            enabledModules={matrix.enabledModules}
            onApplyPreset={handleApplyPreset}
          />

          {/* Sticky Bottom Bar for Unsaved Changes */}
          {canConfigure && matrix.hasChanges && (
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-md sm:px-8">
              <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex size-2.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-amber-500" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">
                      You have unsaved changes for {activeRole?.name ?? 'this role'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Changes will not take effect until you click &quot;Save Permissions&quot;.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<RotateCcw size={14} />}
                    onClick={matrix.discardChanges}
                    disabled={matrix.isSaving}
                  >
                    Discard Changes
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Save size={14} />}
                    isLoading={matrix.isSaving}
                    onClick={handleSave}
                  >
                    Save Permissions
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
