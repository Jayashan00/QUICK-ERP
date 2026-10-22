import { ChevronsLeft, ChevronsRight, X } from 'lucide-react';

import type { NavigationSectionConfig } from '@/app/config/navigationConfig';
import { NavigationMenu } from '@/app/components/navigation/NavigationMenu';
import { IconButton } from '@/shared/components/common/IconButton';
import { cn } from '@/shared/utils/cn';

interface SidebarProps {
  sections: NavigationSectionConfig[];
  collapsed: boolean;
  mobileOpen: boolean;
  area: 'tenant' | 'super-admin';
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
}

export function Sidebar({
  sections,
  collapsed,
  mobileOpen,
  area,
  onToggleCollapsed,
  onCloseMobile,
}: SidebarProps) {
  const label = area === 'super-admin' ? 'Platform Admin' : 'Quick ERP';

  return (
    <>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white shadow-xl transition-[width,transform] duration-200 ease-out lg:z-40 lg:translate-x-0 lg:shadow-none print:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:w-16' : 'lg:w-64',
        )}
        aria-label={area === 'super-admin' ? 'Super Admin sidebar' : 'ERP sidebar'}
      >
        <div className="flex h-16 shrink-0 items-center border-b border-slate-200 px-3">
          <div className={cn('flex min-w-0 flex-1 items-center gap-3', collapsed && 'lg:hidden')}>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              QE
            </div>
            <div className={cn('min-w-0', collapsed && 'lg:hidden')}>
              <div className="truncate text-sm font-bold text-slate-900">{label}</div>
              <div className="truncate text-[11px] font-medium text-slate-500">
                {area === 'super-admin' ? 'Platform Console' : 'Enterprise Management'}
              </div>
            </div>
          </div>

          <IconButton className="lg:hidden" label="Close navigation" icon={<X size={20} />} onClick={onCloseMobile} />
          <IconButton
            className="hidden lg:inline-flex"
            label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            icon={collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            onClick={onToggleCollapsed}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
          <NavigationMenu sections={sections} collapsed={collapsed} onNavigate={onCloseMobile} />
        </div>

        <div className={cn('shrink-0 border-t border-slate-200 p-3', collapsed && 'lg:px-2')}>
          <div className={cn('rounded-lg bg-slate-50 px-3 py-2', collapsed && 'lg:px-2 lg:text-center')}>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {collapsed ? <span className="hidden lg:inline">v1</span> : 'Quick ERP'}
            </div>
            {import.meta.env.DEV && <div className={cn('mt-0.5 text-xs text-slate-500', collapsed && 'lg:hidden')}>
              Mock development environment
            </div>}
          </div>
        </div>
      </aside>

      <button
        type="button"
        aria-label="Close navigation overlay"
        className={cn(
          'fixed inset-0 z-40 bg-slate-950/50 transition-opacity lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onCloseMobile}
      />
    </>
  );
}
