import { projectService } from './projectService';
import type { ModuleDashboardContext } from '@/features/dashboard/types/moduleDashboard';
import { addList, group, ranked, recordLink, sum } from '@/features/dashboard/utils/moduleAnalytics';

export async function aggregateProjectDashboard(context: ModuleDashboardContext) {
  const { scope, can, output, inPeriod, today } = context;
  if (!can('projects.projects.view')) return;
  const projects = projectService.projects(scope, scope.branchId);
  const name = (id: string) => projects.find(row => row.id === id)?.name ?? id;
  output.metrics.push({ label: 'Active projects', value: projects.filter(row => row.status === 'active').length, description: 'Current delivery portfolio', to: '/projects/list' });
  output.charts.push({ id: 'projects', title: 'Project Status', subtitle: 'Current portfolio across delivery states', kind: 'donut', data: group(projects, row => row.status), to: '/projects/list' });
  if (can('projects.tasks.view')) {
    const tasks = projectService.tasks(scope, scope.branchId);
    const open = tasks.filter(row => !['done', 'cancelled'].includes(row.status));
    const overdue = open.filter(row => row.dueDate < today);
    output.metrics.push({ label: 'Tasks due', value: open.filter(row => inPeriod(row.dueDate)).length, description: 'Open tasks due in selected period', to: '/projects/tasks' }, { label: 'Overdue tasks', value: overdue.length, description: 'Current open tasks past due', to: '/projects/tasks' });
    output.charts.push({ id: 'tasks', title: 'Task Status', subtitle: 'Current task workflow across all project tasks', data: group(tasks, row => row.status), to: '/projects/tasks' });
    addList(context, 'Overdue Tasks', overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(row => ({ id: row.id, title: row.title, description: name(row.projectId), date: row.dueDate, status: row.status, to: '/projects/tasks' })), { to: '/projects/tasks', emptyMessage: 'No overdue tasks.' });
  }
  if (can('projects.timesheets.view')) {
    const all = projectService.timesheets(scope, scope.branchId), approved = all.filter(row => row.status === 'approved' && inPeriod(row.date));
    output.metrics.push({ label: 'Billable hours', value: sum(approved.filter(row => row.billable), row => row.hours), description: 'Approved hours in selected period', to: '/projects/timesheets' });
    output.charts.push({ id: 'hours', title: 'Billable vs Non-Billable Hours', subtitle: 'Approved timesheet hours in selected period', data: [{ label: 'Billable', value: sum(approved.filter(row => row.billable), row => row.hours) }, { label: 'Non-billable', value: sum(approved.filter(row => !row.billable), row => row.hours) }], to: '/projects/timesheets' });
    if (can('projects.timesheets.approve')) addList(context, 'Pending Timesheets', all.filter(row => row.status === 'submitted').map(row => ({ id: row.id, title: name(row.projectId), description: `${row.hours} hours / ${row.employeeId}`, date: row.date, status: row.status, to: recordLink('/projects/timesheets', row.id) })), { to: '/projects/timesheets', emptyMessage: 'No timesheets waiting for review.' });
  }
  if (can('projects.reports.view')) {
    const profitability = projects.map(row => ({ project: row, value: projectService.profitability(scope, row.id) }));
    output.metrics.push({ label: 'Estimated profit', value: sum(profitability, row => row.value.estimatedProfit), format: 'currency', description: 'Current project service estimates', to: '/projects/profitability' });
    output.charts.push({ id: 'profitability', title: 'Project Profitability', subtitle: 'Top 5 current estimates from Project accounting rules', currency: true, data: ranked(profitability.map(row => ({ label: row.project.name, value: row.value.estimatedProfit }))), to: '/projects/profitability' });
  }
  if (can('projects.expenses.view')) output.charts.push({ id: 'expenses', title: 'Project Expenses', subtitle: 'Approved project expenses in selected period', currency: true, data: group(projectService.expenses(scope, scope.branchId).filter(row => row.status === 'approved' && inPeriod(row.date)), row => name(row.projectId), row => row.amount), to: '/projects/expenses' });
  if (can('projects.milestones.view')) addList(context, 'Upcoming Milestones', projectService.milestones(scope, scope.branchId).filter(row => row.status === 'open').sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(row => ({ id: row.id, title: row.name, description: `${name(row.projectId)} / ${row.progress}% complete`, date: row.dueDate, status: row.dueDate < today ? 'overdue' : row.status, to: `/projects/${row.projectId}` })), { to: '/projects/milestones' });
  addList(context, 'Recent Project Activity', projectService.audit(scope).filter(row => inPeriod(row.at)).sort((a, b) => b.at.localeCompare(a.at)).map(row => ({ id: row.id, title: row.action, description: `${row.actor} / ${row.reference}`, date: row.at, to: row.projectId ? `/projects/${row.projectId}` : '/projects/audit' })), { subtitle: 'Project audit activity in selected period', to: '/projects/audit', wide: true, emptyMessage: 'No project activity for this period.' });
  output.workflowDescription = 'Project > Milestones > Tasks > Team > Timesheets > Expenses > Billing > Profitability';
  output.workflow = [['Projects', '/projects/list', 'projects.projects.view'], ['Tasks', '/projects/tasks', 'projects.tasks.view'], ['Milestones', '/projects/milestones', 'projects.milestones.view'], ['Timesheets', '/projects/timesheets', 'projects.timesheets.view'], ['Expenses', '/projects/expenses', 'projects.expenses.view'], ['Billing', '/projects/billing', 'projects.billing.view'], ['Profitability', '/projects/profitability', 'projects.reports.view']].filter(([, , permission]) => can(permission)).map(([label, to]) => ({ label, to }));
}
