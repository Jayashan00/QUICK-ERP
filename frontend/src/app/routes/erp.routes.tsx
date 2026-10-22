import { Navigate, type RouteObject } from 'react-router-dom';
import { ERPLayout } from '@/app/layouts/ERPLayout';
import { RequirePermission } from '@/core/permissions/components/RequirePermission';
import { crmRoutes } from './crm.routes';
import { salesRoutes } from './sales.routes';
import { purchasesRoutes } from './purchases.routes';
import { inventoryRoutes } from './inventory.routes';
import { accountingRoutes } from './accounting.routes';
import { hrRoutes } from './hr.routes';
import { projectRoutes } from './projects.routes';
import { documentRoutes } from './documents.routes';
import { posRoutes } from './pos.routes';
import { settingsRoutes } from './settings.routes';
import { syncRoutes } from './sync.routes';
import { notificationRoutes } from './notification.routes';
import { auditRoutes } from './audit.routes';
import { supportRoutes } from './support.routes';
import { lazyPage } from './lazyPage';

const ProfilePage = lazyPage(() => import('@/features/auth/pages/ProfilePage').then(({ ProfilePage }) => ({ default: ProfilePage })));

const DashboardPage = lazyPage(() => import('@/features/dashboard').then(({ DashboardPage }) => ({ default: DashboardPage })));
const ReportsDashboardPage = lazyPage(() => import('@/features/reports').then(({ ReportsDashboardPage }) => ({ default: ReportsDashboardPage })));
const ReportCategoryPage = lazyPage(() => import('@/features/reports').then(({ ReportCategoryPage }) => ({ default: ReportCategoryPage })));
const ReportDetailPage = lazyPage(() => import('@/features/reports').then(({ ReportDetailPage }) => ({ default: ReportDetailPage })));
const SecuritySettingsPage = lazyPage(() => import('@/features/settings/security').then(({ SecuritySettingsPage }) => ({ default: SecuritySettingsPage })));
const reportViewPermissions = ['reports.view', 'reports.sales.view', 'reports.purchases.view', 'reports.inventory.view', 'reports.finance.view', 'reports.hr.view', 'reports.projects.view', 'reports.pos.view'];

export const erpRoutes: RouteObject = {
  path: '/',
  element: <ERPLayout />,
  children: [
    { path: 'profile', element: <ProfilePage /> },
    { index: true, element: <Navigate to="/dashboard" replace /> },
    { path: 'dashboard', element: <DashboardPage /> },
    { path: 'security', element: <SecuritySettingsPage /> },

// Reports
{
  path: 'reports',
  element: <RequirePermission anyOf={reportViewPermissions}><ReportsDashboardPage /></RequirePermission>,
},
{ path: 'reports/financial', element: <Navigate to="/reports/finance" replace /> },
{ path: 'reports/tax', element: <Navigate to="/reports/finance/vat-tax" replace /> },
{
  path: 'reports/:category',
  element: <RequirePermission anyOf={reportViewPermissions}><ReportCategoryPage /></RequirePermission>,
},
{
  path: 'reports/:category/:reportId',
  element: <RequirePermission anyOf={reportViewPermissions}><ReportDetailPage /></RequirePermission>,
},

    ...crmRoutes,
    ...salesRoutes,
    ...purchasesRoutes,
    ...inventoryRoutes,
    ...accountingRoutes,
    ...hrRoutes,
    ...projectRoutes,
    ...documentRoutes,
    ...posRoutes,
    ...settingsRoutes,
    ...syncRoutes,
    ...notificationRoutes,
    ...auditRoutes,
    ...supportRoutes,
  ],
};
