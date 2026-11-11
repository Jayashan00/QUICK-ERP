import type { RouteObject } from 'react-router-dom';
import { RequireTenantAdministrator } from '@/core/permissions/components';
import { lazyPage } from './lazyPage';

const AuditLogPage = lazyPage(() => import('@/features/audit').then(({ AuditLogPage: Page }) => ({ default: Page })));

export const auditRoutes: RouteObject[] = [
  { path: 'audit', element: <RequireTenantAdministrator><AuditLogPage /></RequireTenantAdministrator> },
];
