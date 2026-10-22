import { leadService } from '../leads/services/leadService';
import { opportunityService } from '../opportunities/services/opportunityService';
import { salesService } from '@/features/sales/services/salesService';
import { customerService } from '@/features/customers/services/customerService';
import type { ModuleDashboardContext } from '@/features/dashboard/types/moduleDashboard';
import { addList, group, sum, timeSeries } from '@/features/dashboard/utils/moduleAnalytics';

export async function aggregateCrmDashboard(context: ModuleDashboardContext) {
  const { scope, params, can, output, inPeriod, today } = context;
  const [leadPage, opportunityPage, quotations, customers] = await Promise.all([
    can('leads.view') ? leadService.getAll(scope, { pageSize: Number.MAX_SAFE_INTEGER }) : null,
    can('crm.opportunities.view') ? opportunityService.getOpportunities(scope, { pageSize: Number.MAX_SAFE_INTEGER }) : null,
    can('sales.view') ? salesService.listQuotations(scope, params) : null,
    can('customers.view') ? customerService.getCustomers(scope, { pageSize: Number.MAX_SAFE_INTEGER, status: 'active' }) : null,
  ]);
  const stages = [];
  if (leadPage) {
    const leads = leadPage.data, selected = leads.filter(row => inPeriod(row.createdAt));
    const qualified = selected.filter(row => row.status === 'qualified'), converted = selected.filter(row => row.status === 'converted');
    const followUps = leads.filter(row => row.nextFollowUpAt && row.nextFollowUpAt.slice(0, 10) <= today && !['lost', 'converted'].includes(row.status)).sort((a, b) => (a.nextFollowUpAt ?? '').localeCompare(b.nextFollowUpAt ?? ''));
    output.metrics.push({ label: 'New leads', value: selected.length, description: 'Created in selected period', to: '/crm/leads' }, { label: 'Qualified leads', value: qualified.length, description: 'Leads created in selected period', to: '/crm/leads' }, { label: 'Conversion rate', value: selected.length ? converted.length / selected.length * 100 : 0, format: 'percent', description: 'Converted / new leads in selected period' }, { label: 'Follow-ups due', value: followUps.length, description: 'Due today or overdue', to: '/crm/leads' });
    stages.push({ label: 'New leads', value: selected.length }, { label: 'Qualified leads', value: qualified.length });
    output.charts.push({ id: 'sources', title: 'Lead Sources', subtitle: 'Sources for leads created in selected period', kind: 'donut', data: group(selected, row => row.source), to: '/crm/leads' });
    const events = [...leads.map(row => ({ date: row.createdAt, leads: 1, conversions: 0 })), ...leads.filter(row => row.convertedAt).map(row => ({ date: row.convertedAt!, leads: 0, conversions: 1 }))];
    output.charts.unshift({ id: 'trend', title: 'Lead & Conversion Trend', subtitle: 'New leads and conversions by their event dates', kind: 'area', wide: true, primaryLabel: 'New leads', secondaryLabel: 'Conversions', data: timeSeries(context, events, row => row.date, row => row.leads, row => row.conversions), emptyMessage: 'No lead activity for this period.' });
    addList(context, 'Upcoming Follow-ups', leads.filter(row => row.nextFollowUpAt && !['lost', 'converted'].includes(row.status)).sort((a, b) => (a.nextFollowUpAt ?? '').localeCompare(b.nextFollowUpAt ?? '')).map(row => ({ id: row.id, title: `${row.firstName} ${row.lastName}`, description: row.source, date: row.nextFollowUpAt, status: row.nextFollowUpAt!.slice(0, 10) < today ? 'overdue' : 'pending', to: '/crm/leads' })), { to: '/crm/leads', emptyMessage: 'No scheduled follow-ups.' });
    addList(context, 'Recent Leads', [...selected].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(row => ({ id: row.id, title: `${row.firstName} ${row.lastName}`, description: row.source, date: row.createdAt, status: row.status, to: '/crm/leads' })), { subtitle: 'New leads in selected period', to: '/crm/leads', emptyMessage: 'No leads created for this period.' });
  }
  if (opportunityPage) {
    const open = opportunityPage.data.filter(row => row.status === 'open');
    output.metrics.push({ label: 'Open opportunities', value: open.length, description: 'Current pipeline', to: '/crm/opportunities' }, { label: 'Pipeline value', value: sum(open, row => row.expectedValue), format: 'currency', description: 'Current expected deal value', to: '/crm/opportunities' });
    stages.push({ label: 'Open opportunities', value: open.length });
    output.charts.push({ id: 'opportunity-stage', title: 'Opportunity Stages', subtitle: 'Current open deals by stage', data: group(open, row => row.stage), to: '/crm/opportunities' });
    addList(context, 'Top Opportunities', [...open].sort((a, b) => b.expectedValue - a.expectedValue).map(row => ({ id: row.id, title: row.name, description: row.customerName, amount: row.expectedValue, status: row.stage, to: `/crm/opportunities/${row.id}` })), { to: '/crm/opportunities' });
  }
  if (quotations) stages.push({ label: 'Quotations in period', value: quotations.data.filter(row => inPeriod(row.quotationDate)).length });
  if (customers) stages.push({ label: 'Active customers', value: customers.total });
  if (stages.length) output.charts.push({ id: 'pipeline', title: 'CRM Pipeline', subtitle: 'Period lead activity and current open pipeline; not a conversion cohort', data: stages });
  output.workflow = [['Leads', '/crm/leads', 'leads.view'], ['Opportunities', '/crm/opportunities', 'crm.opportunities.view'], ['Quotations', '/sales/quotations', 'sales.view'], ['Customers', '/customers', 'customers.view']].filter(([, , permission]) => can(permission)).map(([label, to]) => ({ label, to }));
}
