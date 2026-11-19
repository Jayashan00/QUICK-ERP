import type { PageActionPermission } from '../config/sidebarPermissionCatalog';
import { cn } from '@/shared/utils/cn';

interface AdvancedPermissionsPanelProps {
  pageName: string;
  actions: PageActionPermission[];
  selectedPermissions: Set<string>;
  onTogglePermission: (permission: string) => void;
  disabled?: boolean;
}

export function AdvancedPermissionsPanel({
  pageName,
  actions,
  selectedPermissions,
  onTogglePermission,
  disabled = false,
}: AdvancedPermissionsPanelProps) {
  // Group actions by category
  const viewActions = actions.filter((a) => a.category === 'view');
  const manageActions = actions.filter((a) => a.category === 'manage');
  const sensitiveActions = actions.filter((a) => a.category === 'sensitive');

  const groups = [
    { title: 'View & Read', items: viewActions, badge: 'Standard Read', badgeColor: 'bg-sky-100 text-sky-800' },
    { title: 'Standard Operations', items: manageActions, badge: 'Create & Modify', badgeColor: 'bg-emerald-100 text-emerald-800' },
    { title: 'Sensitive & Administrative', items: sensitiveActions, badge: 'Sensitive Actions', badgeColor: 'bg-rose-100 text-rose-800' },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-sm">
      <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Advanced Permissions: {pageName}
          </h4>
          <p className="mt-0.5 text-xs text-slate-500">
            Granular access controls for this ERP page. Custom selections will mark this page as &quot;Custom&quot;.
          </p>
        </div>
        <span className="text-xs font-medium text-slate-500">
          {actions.filter((a) => selectedPermissions.has(a.permission)).length} of {actions.length} granted
        </span>
      </div>

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.title} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-800">{group.title}</span>
              <span className={cn('rounded px-1.5 py-0.2 text-[10px] font-medium', group.badgeColor)}>
                {group.badge}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((action) => {
                const isChecked = selectedPermissions.has(action.permission);
                return (
                  <label
                    key={action.permission}
                    className={cn(
                      'flex items-start gap-2.5 rounded-md border p-2 text-xs transition-colors cursor-pointer select-none',
                      isChecked
                        ? 'border-blue-200 bg-blue-50/60 text-slate-900 font-medium'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                      disabled && 'opacity-60 pointer-events-none cursor-not-allowed',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={disabled}
                      onChange={() => onTogglePermission(action.permission)}
                      className="mt-0.5 size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="leading-snug">{action.label}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-slate-400 truncate">
                        {action.permission}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
