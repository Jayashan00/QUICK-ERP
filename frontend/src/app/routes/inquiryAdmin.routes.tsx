import type { RouteObject } from 'react-router-dom';
import { lazyPage } from './lazyPage';

const InquiryAdminPage = lazyPage(() => import('@/features/inquiry-admin/InquiryAdminPage').then(({ InquiryAdminPage }) => ({ default: InquiryAdminPage })));

/** Standalone admin surface for public product inquiries. */
export const inquiryAdminRoute: RouteObject = {
  path: '/inquiry-admin',
  element: <InquiryAdminPage />,
};
