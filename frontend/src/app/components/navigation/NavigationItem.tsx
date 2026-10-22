import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import type { NavigationItemConfig } from '@/app/config/navigationConfig';
import { cn } from '@/shared/utils/cn';

interface NavigationItemProps {
  item: NavigationItemConfig;
  collapsed: boolean;
  onNavigate?: () => void;
  end?: boolean;
}

function matchesPath(pathname: string, path?: string, end = false) {
  if (!path) return false;
  if (end) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function NavigationItem({
  item,
  collapsed,
  onNavigate,
  end = false,
}: NavigationItemProps) {
  const { pathname } = useLocation();
  const hasChildren = Boolean(item.children?.length);
  const childIsActive = item.children?.some((child) => matchesPath(pathname, child.path)) ?? false;
  const isActive = matchesPath(pathname, item.path, end) || childIsActive;
  const [open, setOpen] = useState(isActive);
  const expanded = open;
  const Icon = item.icon;

  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive, pathname]);

  const itemClasses = cn(
    'group flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1',
    isActive
      ? 'bg-blue-50 text-blue-700'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    collapsed && 'lg:justify-center lg:px-2',
  );

  if (hasChildren) {
    return (
      <div>
        {collapsed && item.path && (
          <Link
            to={item.path}
            className={cn(itemClasses, 'hidden lg:flex')}
            title={item.label}
            aria-current={isActive ? 'page' : undefined}
          >
            {Icon && (
              <Icon
                size={19}
                className={cn('shrink-0', isActive ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-700')}
              />
            )}
            <span className="sr-only">{item.label}</span>
          </Link>
        )}
        <button
          type="button"
          className={cn(itemClasses, collapsed && 'lg:hidden')}
          aria-expanded={expanded}
          title={collapsed ? item.label : undefined}
          onClick={() => setOpen((current) => !current)}
        >
          {Icon && (
            <Icon
              size={19}
              className={cn('shrink-0', isActive ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-700')}
            />
          )}
          <span className={cn('min-w-0 flex-1 truncate', collapsed && 'lg:hidden')}>{item.label}</span>
          <span className={cn('ml-auto text-slate-400', collapsed && 'lg:hidden')} aria-hidden="true">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        </button>

        {expanded && (
          <div className={cn('mt-1 space-y-1 pl-5', collapsed && 'lg:hidden')}>
            {item.children!.map((child) => (
              <NavigationItem
                key={child.path || child.label}
                item={child}
                collapsed={false}
                end={child.path === item.path}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!item.path) return null;

  return (
    <Link
      to={item.path}
      className={itemClasses}
      title={collapsed ? item.label : undefined}
      aria-current={isActive ? 'page' : undefined}
      onClick={onNavigate}
    >
      {Icon && (
        <Icon
          size={19}
          className={cn('shrink-0', isActive ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-700')}
        />
      )}
      <span className={cn('min-w-0 flex-1 truncate', collapsed && 'lg:hidden')}>{item.label}</span>
      {item.badge !== undefined && (
        <span className={cn('rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600', collapsed && 'lg:hidden')}>
          {item.badge}
        </span>
      )}
    </Link>
  );
}
