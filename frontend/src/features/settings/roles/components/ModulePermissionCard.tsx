import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, Shield, ShieldAlert } from 'lucide-react';
import type { SidebarModuleDefinition, SidebarPageDefinition } from '../config/sidebarPermissionCatalog';
import { detectPageLevel } from '../config/sidebarPermissionCatalog';
import { PagePermissionRow } from './PagePermissionRow';
import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { cn } from '@/shared/utils/cn';

interface ModulePermissionCardProps {
  module: SidebarModuleDefinition;
  selectedPermissions: Set<string>;
  onPageLevelChange: (page: SidebarPageDefinition, level: 'no_access' | 'view_only' | 'manage' | 'full_access') => void;
  onTogglePermission: (permission: string) => void;
  onApplyModuleLevel: (module: SidebarModuleDefinition, level: 'full_access' | 'view_only' | 'no_access') => void;
  disabled?: boolean;
  searchFilter?: string;
  accessFilter?: 'all' | 'accessible' | 'no_access';
  isForceExpanded?: boolean;
}

export function ModulePermissionCard({
  module,
  selectedPermissions,
  onPageLevelChange,
  onTogglePermission,
  onApplyModuleLevel,
  disabled = false,
  searchFilter = '',
  accessFilter = 'all',
  isForceExpanded,
}: ModulePermissionCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Filter pages based on search and accessFilter
  const filteredPages = module.pages.filter((page) => {
    const level = detectPageLevel(page, selectedPermissions);

    if (accessFilter === 'accessible' && level === 'no_access') return false;
    if (accessFilter === 'no_access' && level !== 'no_access') return false;

    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      const pageNameMatch = page.name.toLowerCase().includes(q);
      const pathMatch = page.path.toLowerCase().includes(q);
      const moduleMatch = module.name.toLowerCase().includes(q);
      const parentGroupMatch = page.parentGroup?.toLowerCase().includes(q) ?? false;
      const actionMatch = page.actions.some((a) => a.label.toLowerCase().includes(q) || a.permission.toLowerCase().includes(q));
      return pageNameMatch || pathMatch || moduleMatch || parentGroupMatch || actionMatch;
    }

    return true;
  });

  if (filteredPages.length === 0) {
    return null;
  }

  // Calculate module stats
  const totalPages = module.pages.length;
  const accessiblePages = module.pages.filter((p) => detectPageLevel(p, selectedPermissions) !== 'no_access').length;
  const isFullModule = accessiblePages === totalPages && module.pages.every((p) => detectPageLevel(p, selectedPermissions) === 'full_access');

  const expanded = isForceExpanded !== undefined ? isForceExpanded : !isCollapsed;

  return (
    <Card className="overflow-hidden p-0 border border-slate-200 shadow-sm transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 px-4 py-3.5 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            <div
              className={cn(
                'flex size-8 items-center justify-center rounded-lg border text-sm font-semibold transition-colors',
                isFullModule
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : accessiblePages > 0
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-400',
              )}
            >
              {isFullModule ? (
                <CheckCircle2 size={16} />
              ) : accessiblePages > 0 ? (
                <Shield size={16} />
              ) : (
                <ShieldAlert size={16} />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 text-sm">{module.name}</h3>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium border',
                    accessiblePages === totalPages
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : accessiblePages > 0
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200',
                  )}
                >
                  {accessiblePages}/{totalPages} pages accessible
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {isFullModule
                  ? 'Full module access granted'
                  : accessiblePages > 0
                    ? `Partial access (${accessiblePages} of ${totalPages} pages authorized)`
                    : 'No access granted to this module'}
              </p>
            </div>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!disabled && (
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-xs shadow-2xs">
              <button
                type="button"
                onClick={() => onApplyModuleLevel(module, 'full_access')}
                className="rounded px-2.5 py-1 text-slate-700 hover:bg-slate-100 font-medium transition-colors"
                title="Grant full access to all pages in this module"
              >
                Grant Full
              </button>
              <button
                type="button"
                onClick={() => onApplyModuleLevel(module, 'view_only')}
                className="rounded px-2.5 py-1 text-slate-700 hover:bg-slate-100 font-medium transition-colors"
                title="Set all pages in this module to View Only"
              >
                View Only
              </button>
              <button
                type="button"
                onClick={() => onApplyModuleLevel(module, 'no_access')}
                className="rounded px-2.5 py-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 font-medium transition-colors"
                title="Revoke access to all pages in this module"
              >
                Revoke All
              </button>
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-slate-500 hover:text-slate-700"
            rightIcon={expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          >
            {expanded ? 'Collapse' : 'Expand'}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="divide-y divide-slate-100">
          {filteredPages.map((page) => (
            <PagePermissionRow
              key={page.id}
              page={page}
              selectedPermissions={selectedPermissions}
              onLevelChange={(level) => onPageLevelChange(page, level)}
              onTogglePermission={onTogglePermission}
              disabled={disabled}
              forceExpanded={Boolean(searchFilter)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
