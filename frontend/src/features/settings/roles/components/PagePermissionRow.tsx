import { useState } from 'react';
import { ChevronDown, ChevronUp, Sliders } from 'lucide-react';
import type { SidebarPageDefinition } from '../config/sidebarPermissionCatalog';
import { detectPageLevel } from '../config/sidebarPermissionCatalog';
import { PermissionLevelSelector } from './PermissionLevelSelector';
import { AdvancedPermissionsPanel } from './AdvancedPermissionsPanel';
import { Button } from '@/shared/components/common/Button';
import { cn } from '@/shared/utils/cn';

interface PagePermissionRowProps {
  page: SidebarPageDefinition;
  selectedPermissions: Set<string>;
  onLevelChange: (level: 'no_access' | 'view_only' | 'manage' | 'full_access') => void;
  onTogglePermission: (permission: string) => void;
  disabled?: boolean;
  forceExpanded?: boolean;
}

export function PagePermissionRow({
  page,
  selectedPermissions,
  onLevelChange,
  onTogglePermission,
  disabled = false,
  forceExpanded = false,
}: PagePermissionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const isExpanded = forceExpanded || expanded;

  const currentLevel = detectPageLevel(page, selectedPermissions);
  const grantedCount = page.actions.filter((a) => selectedPermissions.has(a.permission)).length;

  return (
    <div
      className={cn(
        'border-b border-slate-100 last:border-b-0 transition-colors',
        currentLevel !== 'no_access' ? 'bg-white' : 'bg-slate-50/40',
      )}
    >
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900 text-sm">{page.name}</span>
            {page.parentGroup && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                {page.parentGroup}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
            <span className="font-mono text-[11px] text-slate-400">{page.path}</span>
            <span>·</span>
            <span>{page.actions.length} action{page.actions.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <PermissionLevelSelector
            currentLevel={currentLevel}
            supportedLevels={page.supportedLevels}
            onChange={onLevelChange}
            disabled={disabled}
            pageName={page.name}
          />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-slate-600 hover:text-slate-900"
            leftIcon={<Sliders size={13} className="text-slate-400" />}
            rightIcon={isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          >
            Customize
            <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-600">
              {grantedCount}/{page.actions.length}
            </span>
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-1">
          <AdvancedPermissionsPanel
            pageName={page.name}
            actions={page.actions}
            selectedPermissions={selectedPermissions}
            onTogglePermission={onTogglePermission}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
