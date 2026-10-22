import { createBrowserRouter } from 'react-router-dom';
import { authRoutes } from './auth.routes';
import { superAdminRoutes } from './platform.routes';
import { erpRoutes } from './erp.routes';
import { NotFoundPage } from '@/app/pages/errors/NotFoundPage';
import { UnauthorizedPage } from '@/app/pages/errors/UnauthorizedPage';
import { PermissionDeniedPage } from '@/app/pages/errors/PermissionDeniedPage';
import { GenericErrorPage } from '@/app/pages/errors/GenericErrorPage';
import { StorefrontPage } from '@/features/storefront/StorefrontPage';

export const router = createBrowserRouter([
  authRoutes,
  superAdminRoutes,
  erpRoutes,
  { path: '/shop/:tenantId/:branchId', element: <StorefrontPage /> },
  { path: '/shop/:tenantId/:branchId/cart', element: <StorefrontPage view="cart" /> },
  { path: '/shop/:tenantId/:branchId/checkout', element: <StorefrontPage view="checkout" /> },
  { path: '/shop/:tenantId/:branchId/orders/:orderId', element: <StorefrontPage view="order" /> },

  // Global Error & Fallback Routes
  { path: '/unauthorized', element: <UnauthorizedPage /> },
  { path: '/forbidden', element: <PermissionDeniedPage /> },
  { path: '/error', element: <GenericErrorPage /> },
  { path: '*', element: <NotFoundPage /> },
]);
