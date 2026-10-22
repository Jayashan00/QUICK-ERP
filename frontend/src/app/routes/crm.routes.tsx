import type { RouteObject } from 'react-router-dom';
import { RequirePermission } from '@/core/permissions/components';
import { TENANT_PERMISSIONS as PERMISSIONS } from '@/core/permissions';
import { lazyPage } from './lazyPage';

const CrmDashboardPage = lazyPage(() => import('@/features/crm/pages/CrmDashboardPage').then(module => ({ default: module.CrmDashboardPage })));
const LeadsPage = lazyPage(() => import('@/features/crm/leads').then(({ LeadsPage }) => ({ default: LeadsPage })));
const OpportunitiesPage = lazyPage(() => import('@/features/crm/opportunities').then(({ OpportunitiesPage }) => ({ default: OpportunitiesPage })));
const OpportunityDetailPage = lazyPage(() => import('@/features/crm/opportunities').then(({ OpportunityDetailPage }) => ({ default: OpportunityDetailPage })));
const OpportunityFormPage = lazyPage(() => import('@/features/crm/opportunities').then(({ OpportunityFormPage }) => ({ default: OpportunityFormPage })));
const CustomersPage = lazyPage(() => import('@/features/customers').then(({ CustomersPage }) => ({ default: CustomersPage })));

export const crmRoutes: RouteObject[] = [
{
  path: 'customers',
  element: (
    <RequirePermission
      permission={PERMISSIONS.CUSTOMERS.VIEW}
      deniedMessage="You don't have permission to view customers."
    >
      <CustomersPage />
    </RequirePermission>
  ),
},
// CRM
{
  path: 'crm',
  element: (
    <RequirePermission anyOf={[PERMISSIONS.LEADS.VIEW, PERMISSIONS.CRM.OPPORTUNITIES_VIEW]}>
      <CrmDashboardPage />
    </RequirePermission>
  ),
},
{
  path: 'crm/leads',
  element: (
    <RequirePermission
      permission={PERMISSIONS.LEADS.VIEW}
      deniedMessage="You don't have permission to view leads."
    >
      <LeadsPage />
    </RequirePermission>
  ),
},
{ path: 'crm/opportunities', element: <RequirePermission permission={PERMISSIONS.CRM.OPPORTUNITIES_VIEW}><OpportunitiesPage /></RequirePermission> },
{ path: 'crm/opportunities/new', element: <RequirePermission permission={PERMISSIONS.CRM.OPPORTUNITIES_CREATE}><OpportunityFormPage /></RequirePermission> },
{ path: 'crm/opportunities/:id', element: <RequirePermission permission={PERMISSIONS.CRM.OPPORTUNITIES_VIEW}><OpportunityDetailPage /></RequirePermission> },
{ path: 'crm/opportunities/:id/edit', element: <RequirePermission permission={PERMISSIONS.CRM.OPPORTUNITIES_EDIT}><OpportunityFormPage /></RequirePermission> },
];
