import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Settings, ShieldCheck, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/core/auth/auth-context';
import { usePermissions } from '@/core/permissions/permission-context';
import { PLATFORM_PERMISSIONS, TENANT_PERMISSIONS } from '@/core/permissions';

interface UserMenuProps {
  area: 'tenant' | 'super-admin';
}

export function UserMenu({ area }: UserMenuProps) {
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!user) return null;

  const initials = user.name.split(' ').map((name) => name[0]).join('').toUpperCase().slice(0, 2);
  const settingsPath = area === 'super-admin' ? '/super-admin/settings' : '/settings/company';
  const profilePath = area === 'super-admin' ? '/super-admin/profile' : '/profile';
  const canViewSettings = area === 'super-admin'
    ? Boolean(user.isSuperAdmin && hasPermission(PLATFORM_PERMISSIONS.SUPER_ADMIN.SETTINGS_VIEW))
    : hasPermission(TENANT_PERMISSIONS.SETTINGS.COMPANY_VIEW);

  const navigateTo = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="flex h-10 min-w-10 items-center gap-2 rounded-lg border border-transparent px-1.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:border-slate-200 sm:pr-2.5"
        aria-label={`Open user menu for ${user.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{initials}</span>
        <span className="hidden min-w-0 lg:block">
          <span className="block max-w-32 truncate text-sm font-semibold text-slate-900">{user.name}</span>
          <span className="block max-w-32 truncate text-[11px] text-slate-500">{user.roleName}</span>
        </span>
        <ChevronDown size={14} className="hidden shrink-0 text-slate-400 lg:block" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          <div className="px-3 py-2.5">
            <div className="truncate text-sm font-semibold text-slate-900">{user.name}</div>
            <div className="mt-0.5 truncate text-xs text-slate-500">{user.email}</div>
            <div className="mt-1 text-xs font-medium text-blue-600">{user.roleName}</div>
          </div>
          <div className="my-1 border-t border-slate-200" />
          <button type="button" role="menuitem" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" onClick={() => navigateTo(profilePath)}>
              <User size={17} className="text-slate-500" /> Profile
          </button>
          {canViewSettings && (
            <button type="button" role="menuitem" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" onClick={() => navigateTo(settingsPath)}>
              <Settings size={17} className="text-slate-500" /> Settings
            </button>
          )}
          {area === 'tenant' && (
            <button type="button" role="menuitem" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" onClick={() => navigateTo('/security')}>
              <ShieldCheck size={17} className="text-slate-500" /> Security
            </button>
          )}

          <div className="my-1 border-t border-slate-200" />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            onClick={() => {
              setOpen(false);
              logout();
              navigate('/login', { replace: true });
            }}
          >
            <LogOut size={17} /> Logout
          </button>
        </div>
      )}
    </div>
  );
}
