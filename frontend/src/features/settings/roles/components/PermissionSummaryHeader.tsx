import { Layers, FileText, KeyRound } from 'lucide-react';
import type { SidebarCatalogSection } from '../config/sidebarPermissionCatalog';
import { detectPageLevel } from '../config/sidebarPermissionCatalog';
import { Card } from '@/shared/components/common/Card';

interface PermissionSummaryHeaderProps {
  sections: SidebarCatalogSection[];
  selectedPermissions: Set<string>;
}

export function PermissionSummaryHeader({
  sections,
  selectedPermissions,
}: PermissionSummaryHeaderProps) {
  const allModules = sections.flatMap((s) => s.modules);
  const allPages = allModules.flatMap((m) => m.pages);

  // Metrics
  const totalModulesCount = allModules.length;
  const accessibleModulesCount = allModules.filter((mod) =>
    mod.pages.some((page) => detectPageLevel(page, selectedPermissions) !== 'no_access'),
  ).length;

  const totalPagesCount = allPages.length;
  let accessiblePagesCount = 0;
  let fullAccessCount = 0;
  let manageCount = 0;
  let viewOnlyCount = 0;
  let customCount = 0;
  let noAccessCount = 0;

  for (const page of allPages) {
    const level = detectPageLevel(page, selectedPermissions);
    if (level === 'full_access') {
      fullAccessCount += 1;
      accessiblePagesCount += 1;
    } else if (level === 'manage') {
      manageCount += 1;
      accessiblePagesCount += 1;
    } else if (level === 'view_only') {
      viewOnlyCount += 1;
      accessiblePagesCount += 1;
    } else if (level === 'custom') {
      customCount += 1;
      accessiblePagesCount += 1;
    } else {
      noAccessCount += 1;
    }
  }

  const grantedPermissionsCount = selectedPermissions.size;

  return (
    <Card className="border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {/* Metric 1: Accessible Modules */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Layers size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">Accessible Modules</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900">{accessibleModulesCount}</span>
              <span className="text-xs text-slate-400">/ {totalModulesCount}</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Accessible Pages */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <FileText size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">Accessible Pages</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900">{accessiblePagesCount}</span>
              <span className="text-xs text-slate-400">/ {totalPagesCount}</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Total Granted Permissions */}
        <div className="flex items-center gap-3 sm:border-r sm:pr-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <KeyRound size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">Total Granted</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900">{grantedPermissionsCount}</span>
              <span className="text-xs text-slate-400">permissions</span>
            </div>
          </div>
        </div>

        {/* Breakdown Badges */}
        <div className="flex flex-col justify-center sm:col-span-3 lg:col-span-1">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">Page Access Status</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200">
              Full: {fullAccessCount}
            </span>
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
              Manage: {manageCount}
            </span>
            <span className="rounded bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 border border-sky-200">
              View: {viewOnlyCount}
            </span>
            {customCount > 0 && (
              <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                Custom: {customCount}
              </span>
            )}
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              None: {noAccessCount}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
