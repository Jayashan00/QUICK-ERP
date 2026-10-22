import { type RouteObject } from 'react-router-dom';
import { RequirePermission } from '@/core/permissions/components';
import { TENANT_PERMISSIONS as P } from '@/core/permissions';
import { lazyPage } from './lazyPage';

const DocumentsPage = lazyPage(() => import('@/features/documents/DocumentsPage').then(({ DocumentsPage }) => ({ default: DocumentsPage })));
export const documentRoutes: RouteObject[] = [
  { path: 'documents', element: <RequirePermission permission={P.DOCUMENTS.VIEW}><DocumentsPage /></RequirePermission> },
];
