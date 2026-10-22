import type { RouteObject } from 'react-router-dom';
import { RequirePermission } from '@/core/permissions/components';
import { lazyPage } from './lazyPage';

const SupportTicketsPage = lazyPage(() => import('@/features/support/pages/SupportTicketsPage').then((module) => ({ default: module.SupportTicketsPage })));
const CreateSupportTicketPage = lazyPage(() => import('@/features/support/pages/CreateSupportTicketPage').then((module) => ({ default: module.CreateSupportTicketPage })));
const SupportTicketDetailPage = lazyPage(() => import('@/features/support/pages/SupportTicketDetailPage').then((module) => ({ default: module.SupportTicketDetailPage })));

export const supportRoutes: RouteObject[] = [
  { path: 'support', element: <RequirePermission permission="support.view"><SupportTicketsPage /></RequirePermission> },
  { path: 'support/tickets', element: <RequirePermission permission="support.view"><SupportTicketsPage /></RequirePermission> },
  { path: 'support/tickets/new', element: <RequirePermission permission="support.create"><CreateSupportTicketPage /></RequirePermission> },
  { path: 'support/tickets/:id', element: <RequirePermission permission="support.view"><SupportTicketDetailPage /></RequirePermission> },
];
