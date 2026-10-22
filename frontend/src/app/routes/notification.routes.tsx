import type { RouteObject } from 'react-router-dom';
import { RequirePermission } from '@/core/permissions/components';
import { lazyPage } from './lazyPage';

const NotificationCenterPage = lazyPage(() => import('@/features/notifications/pages/NotificationCenterPage').then((module) => ({ default: module.NotificationCenterPage })));
const ArchivedNotificationsPage = lazyPage(() => import('@/features/notifications/pages/ArchivedNotificationsPage').then((module) => ({ default: module.ArchivedNotificationsPage })));
const NoticesPage = lazyPage(() => import('@/features/notifications/pages/NoticesPage').then((module) => ({ default: module.NoticesPage })));
const NotificationTemplatesPage = lazyPage(() => import('@/features/notifications/pages/NotificationTemplatesPage').then((module) => ({ default: module.NotificationTemplatesPage })));

export const notificationRoutes: RouteObject[] = [
  { path: 'notifications', element: <RequirePermission permission="notifications.view"><NotificationCenterPage /></RequirePermission> },
  { path: 'notifications/archived', element: <RequirePermission permission="notifications.view"><ArchivedNotificationsPage /></RequirePermission> },
  { path: 'notifications/notices', element: <RequirePermission permission="notices.view"><NoticesPage /></RequirePermission> },
  { path: 'notifications/templates', element: <RequirePermission permission="notificationTemplates.manage"><NotificationTemplatesPage /></RequirePermission> },
];
