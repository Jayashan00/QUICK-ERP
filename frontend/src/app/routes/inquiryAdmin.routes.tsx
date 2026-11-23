import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';

/** Keep old bookmarks working through the protected super admin console. */
export const inquiryAdminRoute: RouteObject = {
  path: '/inquiry-admin',
  element: <Navigate to="/super-admin/inquiries" replace />,
};
