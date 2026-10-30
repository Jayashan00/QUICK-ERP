import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { APP_CONSTANTS } from '@/shared/constants/appConstants';
import { cn } from '@/shared/utils/cn';
import type { NavigationSectionConfig } from '@/app/config/navigationConfig';
import { filterNavigationSections } from '@/core/permissions';
import { usePermissions } from '@/core/permissions/permission-context';
import { useTenant } from '@/core/tenant/tenant-context';
import type { TenantModule } from '@/core/tenant/tenantEntitlements';

import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { OfflineBanner } from '@/features/sync';

interface AppShellProps {
  children: ReactNode;
  navigationSections: NavigationSectionConfig[];
  area?: 'tenant' | 'super-admin';
}

function getInitialCollapsedState() {
  try {
    return localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
  } catch {
    return false;
  }
}

export function AppShell({ children, navigationSections, area = 'tenant' }: AppShellProps) {
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const { currentTenant } = useTenant();
  const [collapsed, setCollapsed] = useState(getInitialCollapsedState);
  const [mobileOpen, setMobileOpen] = useState(false);
  const permittedSections = useMemo(
    () => filterNavigationSections(
      navigationSections,
      hasPermission,
      area === 'tenant' && currentTenant
        ? (module: TenantModule) => currentTenant.entitlements.enabledModules.includes(module)
        : undefined,
    ),
    [area, currentTenant, navigationSections, hasPermission],
  );

  const toggleSidebar = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.SIDEBAR_COLLAPSED, String(next));
      } catch {
        // The shell still works if storage is unavailable.
      }
      return next;
    });
  }, []);

  const toggleMobileNav = useCallback(() => setMobileOpen((open) => !open), []);
  const closeMobileNav = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const closeDrawerAtDesktopWidth = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };

    window.addEventListener('resize', closeDrawerAtDesktopWidth);
    return () => window.removeEventListener('resize', closeDrawerAtDesktopWidth);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        sections={permittedSections}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        area={area}
        onToggleCollapsed={toggleSidebar}
        onCloseMobile={closeMobileNav}
      />

      <div
        className={cn(
          'flex min-h-screen min-w-0 flex-col transition-[margin] duration-200 ease-out print:ml-0',
          collapsed ? 'lg:ml-16' : 'lg:ml-64',
        )}
      >
        <Header area={area} mobileOpen={mobileOpen} onToggleMobileNav={toggleMobileNav} />
        {area === 'tenant' && <OfflineBanner />}
        <main className="min-w-0 flex-1 overflow-x-hidden bg-slate-50 px-4 py-5 sm:px-6 sm:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
