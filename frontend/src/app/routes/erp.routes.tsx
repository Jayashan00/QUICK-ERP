import { Navigate, type RouteObject } from 'react-router-dom';
import { ERPLayout } from '@/app/layouts/ERPLayout';
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
import { NotFoundPage } from '@/app/pages/errors/NotFoundPage';

const ProfilePage = lazyPage(() => import('@/features/auth/pages/ProfilePage').then(({ ProfilePage }) => ({ default: ProfilePage })));

const DashboardPage = lazyPage(() => import('@/features/dashboard').then(({ DashboardPage }) => ({ default: DashboardPage })));
const SecuritySettingsPage = lazyPage(() => import('@/features/settings/security').then(({ SecuritySettingsPage }) => ({ default: SecuritySettingsPage })));

export const erpRoutes: RouteObject = {
  path: '/:companySlug/:roleSlug/:userSlug',
  element: <ERPLayout />,
  children: [
    { path: 'profile', element: <ProfilePage /> },
    { index: true, element: <Navigate to="dashboard" replace /> },
    { path: 'dashboard', element: <DashboardPage /> },
    { path: 'security', element: <SecuritySettingsPage /> },

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
    { path: '*', element: <NotFoundPage /> },
  ],
};
