import type { RouteObject } from 'react-router-dom';
import type { ComponentType } from 'react';
import { Navigate } from 'react-router-dom';
import { SuperAdminLayout } from '@/app/layouts/SuperAdminLayout';
import { RequirePermission } from '@/core/permissions/components';
import { PLATFORM_PERMISSIONS } from '@/core/permissions';
import { lazyPage } from './lazyPage';

const ProfilePage = lazyPage(() => import('@/features/auth/pages/ProfilePage').then(({ ProfilePage }) => ({ default: ProfilePage })));

const platformPage = <K extends keyof typeof import('@/features/platform')>(name: K) =>
  lazyPage(() => import('@/features/platform').then((module) => ({ default: module[name] as ComponentType })));

const PlatformDashboardPage = platformPage('PlatformDashboardPage');
const TenantsPage = platformPage('TenantsPage');
const TenantDetailPage = platformPage('TenantDetailPage');
const UsagePage = platformPage('UsagePage');
const PlatformSettingsPage = platformPage('PlatformSettingsPage');
const PlatformReportsPage = platformPage('PlatformReportsPage');
const SecurityPage = platformPage('SecurityPage');
const PlatformUsersPage = platformPage('PlatformUsersPage');
const AuditLogsPage = platformPage('AuditLogsPage');
const SupportPage = platformPage('SupportPage');
const PlatformHealthPage = platformPage('PlatformHealthPage');

export const superAdminRoutes: RouteObject = {
  path: '/super-admin',
  element: <SuperAdminLayout />,
  children: [
    { path: 'profile', element: <ProfilePage /> },
    { index: true, element: <Navigate to="/super-admin/dashboard" replace /> },
    { path: 'dashboard', element: <RequirePermission permission={PLATFORM_PERMISSIONS.SUPER_ADMIN.DASHBOARD_VIEW}><PlatformDashboardPage /></RequirePermission> },
    { path: 'tenants', element: <RequirePermission permission={PLATFORM_PERMISSIONS.SUPER_ADMIN.TENANTS_VIEW}><TenantsPage /></RequirePermission> },
    { path: 'tenants/:tenantId', element: <RequirePermission permission={PLATFORM_PERMISSIONS.SUPER_ADMIN.TENANTS_VIEW}><TenantDetailPage /></RequirePermission> },
    { path: 'usage', element: <RequirePermission permission={PLATFORM_PERMISSIONS.SUPER_ADMIN.USAGE_VIEW}><UsagePage /></RequirePermission> },
    { path: 'settings', element: <RequirePermission permission={PLATFORM_PERMISSIONS.SUPER_ADMIN.SETTINGS_VIEW}><PlatformSettingsPage /></RequirePermission> },
    { path: 'reports', element: <RequirePermission permission={PLATFORM_PERMISSIONS.SUPER_ADMIN.REPORTS_VIEW}><PlatformReportsPage /></RequirePermission> },
    { path: 'security', element: <RequirePermission permission={PLATFORM_PERMISSIONS.SUPER_ADMIN.SECURITY_VIEW}><SecurityPage /></RequirePermission> },
    { path: 'users', element: <RequirePermission permission={PLATFORM_PERMISSIONS.SUPER_ADMIN.USERS_VIEW}><PlatformUsersPage /></RequirePermission> },
    { path: 'audit-logs', element: <RequirePermission permission={PLATFORM_PERMISSIONS.SUPER_ADMIN.AUDIT_LOGS_VIEW}><AuditLogsPage /></RequirePermission> },
    { path: 'support', element: <RequirePermission permission={PLATFORM_PERMISSIONS.SUPER_ADMIN.SUPPORT_VIEW}><SupportPage /></RequirePermission> },
    { path: 'health', element: <RequirePermission permission={PLATFORM_PERMISSIONS.SUPER_ADMIN.HEALTH_VIEW}><PlatformHealthPage /></RequirePermission> },
  ],
};
