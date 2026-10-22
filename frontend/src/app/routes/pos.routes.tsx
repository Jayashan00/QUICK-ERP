import { Navigate, type RouteObject } from 'react-router-dom';
import { PosShiftsPage, PosReturnsPage } from '@/features/pos/pages/PosPages';
import { PosTerminalPage } from '@/features/pos/pages/PosTerminalPage';
import { PosSettingsPage } from '@/features/pos/pages/PosSettingsPage';
import { lazyPage } from './lazyPage';
import { PosReceiptsPage } from '@/features/pos/pages/PosReceiptsPage';
import { PosCustomerDisplayPage } from '@/features/pos/pages/PosCustomerDisplayPage';
import { PosKitchenPage } from '@/features/pos/pages/PosKitchenPage';
import { PosWebOrdersPage } from '@/features/pos/pages/PosWebOrdersPage';

const PosReportsPage = lazyPage(() => import('@/features/pos/pages/PosReportsPage').then(module => ({ default: module.PosReportsPage })));

export const posRoutes: RouteObject[] = [
// POS
{
  path: 'pos',
  element: <Navigate to="/pos/terminal" replace />,
},
{
  path: 'pos/terminal',
  element: <PosTerminalPage />,
},
{ path: 'pos/shifts', element: <PosShiftsPage /> },
{ path: 'pos/returns', element: <PosReturnsPage /> },
{ path: 'pos/customer-display', element: <PosCustomerDisplayPage /> },
{ path: 'pos/kitchen', element: <PosKitchenPage /> },
{ path: 'pos/web-orders', element: <PosWebOrdersPage /> },
{ path: 'pos/settings', element: <PosSettingsPage /> },
{ path: 'pos/reports', element: <PosReportsPage /> },
{ path: 'pos/receipts', element: <PosReceiptsPage /> },
];
